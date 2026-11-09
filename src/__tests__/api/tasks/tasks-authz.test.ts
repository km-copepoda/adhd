import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/tasks/route";
import { DELETE } from "@/app/api/tasks/[id]/route";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest, makeParams } from "../../helpers/request";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import {
  parentUserWithFamily,
  childUserWithFamily,
  childUser,
  taskTemplate,
  questInstance,
} from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/tasks - assignedChildId の family 検証 (#186)", () => {
  it("他家族の子供 ID を指定すると 403 を返し、タスクを作らないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await POST(
      makeRequest("/api/tasks", { title: "x", category: "STUDY", assignedChildId: "other-child" }),
    );
    expect(res.status).toBe(403);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "other-child", familyId: "fam-1", role: "CHILD" },
      }),
    );
    expect(mockPrisma.taskTemplate.count).not.toHaveBeenCalled();
    expect(mockPrisma.taskTemplate.create).not.toHaveBeenCalled();
  });

  it("自家族の子供なら作成できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.taskTemplate.count.mockResolvedValue(0);
    mockPrisma.taskTemplate.create.mockResolvedValue(taskTemplate({ id: "t-new" }));

    const res = await POST(
      makeRequest("/api/tasks", { title: "x", category: "STUDY", assignedChildId: "child-1" }),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.taskTemplate.create).toHaveBeenCalled();
  });

  it("CHILD ロールは assignedChildId を無視して自分に作成されること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.taskTemplate.count.mockResolvedValue(0);
    mockPrisma.taskTemplate.create.mockResolvedValue(taskTemplate({ id: "t-new" }));
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await POST(
      makeRequest("/api/tasks", { title: "x", category: "STUDY", assignedChildId: "other-child" }),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ assignedChildId: "child-1" }),
    });
  });
});

describe("DELETE /api/tasks/[id] - CHILD の削除範囲 (#186)", () => {
  it("子供の削除は自分の一時タスクに限定して検索すること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.taskTemplate.findFirst.mockResolvedValue(taskTemplate({ id: "t1" }));
    mockPrisma.taskTemplate.update.mockResolvedValue(taskTemplate({ id: "t1" }));

    const res = await DELETE(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    expect(res.status).toBe(200);
    expect(mockPrisma.taskTemplate.findFirst).toHaveBeenCalledWith({
      where: {
        id: "t1",
        createdBy: "CHILD",
        familyId: "fam-1",
        assignedChildId: "child-1",
        isTemporary: true,
      },
    });
  });

  it("兄弟のタスク（条件に合致しない）は 403 で、soft-delete されないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.taskTemplate.findFirst.mockResolvedValue(null);

    const res = await DELETE(makeRequest("/api/tasks/sib", {}), makeParams("sib"));
    expect(res.status).toBe(403);
    expect(mockPrisma.taskTemplate.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/tasks/[id] - 却下時の XP 回収と宣言ボーナス (#186)", () => {
  function setup(opts: {
    quests: Array<{ id: string; reportedAt: Date | null; deadline?: boolean }>;
    declarations: Date[];
    studyPt: number;
  }) {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.taskTemplate.findFirst.mockResolvedValue({
      ...taskTemplate({ id: "t1", createdBy: "CHILD", photoBonus: false, category: "STUDY" }),
      quests: opts.quests.map((q) => ({
        ...questInstance({
          id: q.id,
          templateId: "t1",
          childId: "child-1",
          status: "APPROVED",
          reportedAt: q.reportedAt,
          deadlineBonusEarned: q.deadline ?? false,
        }),
        child: childUser({ id: "child-1" }),
      })),
    } as never);
    mockPrisma.questDeclaration.findMany.mockResolvedValue(
      opts.declarations.map((date) => ({
        id: "d",
        templateId: "t1",
        childId: "child-1",
        date,
        createdAt: new Date(),
      })),
    );
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ id: "child-1", studyPt: opts.studyPt, staminaPt: 0, lifePt: 0 }),
    );
    mockPrisma.user.update.mockResolvedValue(childUser());
    mockPrisma.questInstance.updateMany.mockResolvedValue({ count: opts.quests.length });
    mockPrisma.taskTemplate.update.mockResolvedValue(taskTemplate());
  }

  it("宣言済みの承認クエストは宣言ボーナス分も差し引くこと", async () => {
    // 2026-03-12T05:00Z = JST 14:00 同日 → 報告日 2026-03-12
    setup({
      quests: [{ id: "q1", reportedAt: new Date("2026-03-12T05:00:00Z") }],
      declarations: [new Date("2026-03-12T00:00:00Z")],
      studyPt: 10,
    });
    await DELETE(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    // 1(基本) + 1(宣言) = 2
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { studyPt: 8, staminaPt: 0, lifePt: 0 },
    });
  });

  it("宣言なしは従来どおり基本XPのみ差し引くこと", async () => {
    setup({
      quests: [{ id: "q1", reportedAt: new Date("2026-03-12T05:00:00Z") }],
      declarations: [],
      studyPt: 10,
    });
    await DELETE(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { studyPt: 9, staminaPt: 0, lifePt: 0 },
    });
  });

  it("報告日は JST 基準で判定すること（UTC 前日 15:00 以降は JST 翌日）", async () => {
    // 2026-03-11T16:00Z = JST 2026-03-12 01:00 → 宣言日 03-12 と一致
    setup({
      quests: [{ id: "q1", reportedAt: new Date("2026-03-11T16:00:00Z") }],
      declarations: [new Date("2026-03-12T00:00:00Z")],
      studyPt: 10,
    });
    await DELETE(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { studyPt: 8, staminaPt: 0, lifePt: 0 },
    });
  });

  it("別日の宣言は対象クエストに適用されないこと", async () => {
    setup({
      quests: [
        { id: "q1", reportedAt: new Date("2026-03-12T05:00:00Z") },
        { id: "q2", reportedAt: new Date("2026-03-13T05:00:00Z"), deadline: true },
      ],
      declarations: [new Date("2026-03-12T00:00:00Z")],
      studyPt: 10,
    });
    await DELETE(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    // q1: 1+1(宣言)=2, q2: 1+1(期限)=2 → 4
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { studyPt: 6, staminaPt: 0, lifePt: 0 },
    });
  });

  it("承認済み（createdBy が PARENT に変わった）タスクの削除ではXPを差し引かないこと", async () => {
    // docs/decisions.md「仮タスク却下時のXP没収」は SUPERSEDED。
    // 承認後に親が削除しても、承認時に付与済みのXPは取り上げない
    setup({
      quests: [{ id: "q1", reportedAt: new Date("2026-03-12T05:00:00Z") }],
      declarations: [new Date("2026-03-12T00:00:00Z")],
      studyPt: 10,
    });
    mockPrisma.taskTemplate.findFirst.mockResolvedValue({
      ...taskTemplate({
        id: "t1",
        createdBy: "PARENT",
        originalCreatedBy: "CHILD",
        isTemporary: true,
        category: "STUDY",
      }),
      quests: [
        {
          ...questInstance({ id: "q1", templateId: "t1", childId: "child-1", status: "APPROVED" }),
          child: childUser({ id: "child-1" }),
        },
      ],
    } as never);
    await DELETE(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.questInstance.updateMany).not.toHaveBeenCalled();
  });

  it("回収で 0 未満にならないこと", async () => {
    setup({
      quests: [{ id: "q1", reportedAt: new Date("2026-03-12T05:00:00Z") }],
      declarations: [new Date("2026-03-12T00:00:00Z")],
      studyPt: 1,
    });
    await DELETE(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { studyPt: 0, staminaPt: 0, lifePt: 0 },
    });
  });
});
