import { describe, it, expect, vi, beforeEach } from "vitest";
import { PUT, PATCH, DELETE } from "@/app/api/tasks/[id]/route";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest, makeParams } from "../../helpers/request";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, childUser, taskTemplate, questInstance } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── PUT /api/tasks/[id] ─────────────────────────────

describe("PUT /api/tasks/[id]", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await PUT(makeRequest("/api/tasks/t1", { title: "test" }), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("CHILDロールの場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await PUT(makeRequest("/api/tasks/t1", { title: "test" }), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("PARENTがタスクを更新できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const updated = taskTemplate({ id: "t1", title: "更新後" });
    mockPrisma.taskTemplate.update.mockResolvedValue(updated);

    const res = await PUT(
      makeRequest("/api/tasks/t1", {
        title: "更新後",
        emoji: "📝",
        category: "STUDY",
        repeatDays: [0, 6],
      }),
      makeParams("t1")
    );
    const json = await res.json();

    expect(json.title).toBe("更新後");
    expect(mockPrisma.taskTemplate.update).toHaveBeenCalledWith({
      where: { id: "t1", familyId: "fam-1" },
      data: {
        title: "更新後",
        emoji: "📝",
        category: "STUDY",
        repeatDays: [0, 6],
        photoBonus: undefined,
      },
    });
  });

  it("photoBonus=true を指定してタスクを更新できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.taskTemplate.update.mockResolvedValue(taskTemplate({ id: "t1", photoBonus: true }));

    const res = await PUT(
      makeRequest("/api/tasks/t1", {
        title: "宿題",
        emoji: "📝",
        category: "STUDY",
        repeatDays: [1, 2, 3, 4, 5],
        photoBonus: true,
      }),
      makeParams("t1")
    );
    const json = await res.json();

    expect(json.photoBonus).toBe(true);
    expect(mockPrisma.taskTemplate.update).toHaveBeenCalledWith({
      where: { id: "t1", familyId: "fam-1" },
      data: expect.objectContaining({ photoBonus: true }),
    });
  });

  it("familyIdがnullのPARENTは403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    const res = await PUT(
      makeRequest("/api/tasks/t1", { title: "test" }),
      makeParams("t1")
    );
    expect(res.status).toBe(403);
  });
});

// ─── PATCH /api/tasks/[id] ───────────────────────────

describe("PATCH /api/tasks/[id]", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await PATCH(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("CHILDロールの場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await PATCH(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("PARENTが仮タスクを承認（createdBy→PARENT）できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.taskTemplate.update.mockResolvedValue(taskTemplate({ id: "t1", createdBy: "PARENT" }));

    const res = await PATCH(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    const json = await res.json();

    expect(json.createdBy).toBe("PARENT");
    expect(mockPrisma.taskTemplate.update).toHaveBeenCalledWith({
      where: { id: "t1", familyId: "fam-1" },
      data: { createdBy: "PARENT" },
    });
  });
});

// ─── DELETE /api/tasks/[id] ──────────────────────────

describe("DELETE /api/tasks/[id]", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await DELETE(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("子供が自分の一時タスクを削除できること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.taskTemplate.findFirst.mockResolvedValue(taskTemplate({ id: "t1", createdBy: "CHILD" }));
    mockPrisma.taskTemplate.update.mockResolvedValue(taskTemplate({ id: "t1", isActive: false }));

    const res = await DELETE(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(mockPrisma.taskTemplate.update).toHaveBeenCalledWith({
      where: { id: "t1", familyId: "fam-1" },
      data: { isActive: false },
    });
  });

  it("子供が他人のタスクを削除できないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.taskTemplate.findFirst.mockResolvedValue(null);

    const res = await DELETE(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("親が仮タスクを却下する際、APPROVED済みクエストのXPのみ差し引くこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

    const taskWithQuests = {
      ...taskTemplate({ id: "t1", createdBy: "CHILD", photoBonus: false, category: "STUDY" }),
      quests: [
        {
          ...questInstance({ id: "q1", childId: "child-1", status: "REPORTED", deadlineBonusEarned: false, photoUrl: null }),
          child: childUser({ id: "child-1", studyPt: 10, staminaPt: 5, lifePt: 3 }),
        },
        {
          ...questInstance({ id: "q2", childId: "child-1", status: "APPROVED", deadlineBonusEarned: false, photoUrl: null }),
          child: childUser({ id: "child-1", studyPt: 10, staminaPt: 5, lifePt: 3 }),
        },
      ],
    };
    mockPrisma.taskTemplate.findFirst.mockResolvedValue(taskWithQuests);

    // findUnique で最新データを取得（stale data対策）
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ id: "child-1", studyPt: 10, staminaPt: 5, lifePt: 3 })
    );
    mockPrisma.user.update.mockResolvedValue(childUser());
    mockPrisma.questInstance.updateMany.mockResolvedValue({ count: 2 });
    mockPrisma.taskTemplate.update.mockResolvedValue(taskTemplate());

    const res = await DELETE(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    const json = await res.json();

    expect(json.ok).toBe(true);
    // APPROVED の 1件のみXP差し引き（REPORTEDはXP未付与なので除外）
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: {
        studyPt: 9, // 10 - 1
        staminaPt: 5,
        lifePt: 3,
      },
    });
    // 全クエスト（REPORTED + APPROVED）をREJECTEDに一括更新
    expect(mockPrisma.questInstance.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["q1", "q2"] } },
      data: { status: "REJECTED" },
    });
  });

  it("複数APPROVED クエストのXPが正しく累計で差し引かれること（stale data防止）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

    const taskWithQuests = {
      ...taskTemplate({ id: "t1-multi", createdBy: "CHILD", photoBonus: true, category: "STUDY" }),
      quests: [
        {
          ...questInstance({ id: "q-a1", childId: "child-1", status: "APPROVED", deadlineBonusEarned: true, photoUrl: "photo.jpg" }),
          child: childUser({ id: "child-1", studyPt: 10, staminaPt: 5, lifePt: 3 }),
        },
        {
          ...questInstance({ id: "q-a2", childId: "child-1", status: "APPROVED", deadlineBonusEarned: false, photoUrl: null }),
          child: childUser({ id: "child-1", studyPt: 10, staminaPt: 5, lifePt: 3 }),
        },
      ],
    };
    mockPrisma.taskTemplate.findFirst.mockResolvedValue(taskWithQuests);

    // 最新のchildデータ
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ id: "child-1", studyPt: 10, staminaPt: 5, lifePt: 3 })
    );
    mockPrisma.user.update.mockResolvedValue(childUser());
    mockPrisma.questInstance.updateMany.mockResolvedValue({ count: 2 });
    mockPrisma.taskTemplate.update.mockResolvedValue(taskTemplate());

    await DELETE(makeRequest("/api/tasks/t1-multi", {}), makeParams("t1-multi"));

    // q-a1: 1(基本) + 1(期限) + 1(写真) = 3pt, q-a2: 1pt → 合計4pt
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: {
        studyPt: 6, // 10 - 4
        staminaPt: 5,
        lifePt: 3,
      },
    });
  });

  it("親がPARENT作成タスクを削除する際、XP差し引きしないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

    const taskWithQuests = {
      ...taskTemplate({ id: "t2", createdBy: "PARENT" }),
      quests: [] as unknown[],
    };
    mockPrisma.taskTemplate.findFirst.mockResolvedValue(taskWithQuests);
    mockPrisma.taskTemplate.update.mockResolvedValue(taskTemplate());

    const res = await DELETE(makeRequest("/api/tasks/t2", {}), makeParams("t2"));
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("XP差し引きで負数にならないこと（Math.max(0, ...)）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

    const taskWithQuests = {
      ...taskTemplate({ id: "t3", createdBy: "CHILD", photoBonus: false, category: "STAMINA" }),
      quests: [
        {
          ...questInstance({ id: "q3", childId: "child-2", status: "APPROVED", deadlineBonusEarned: false, photoUrl: null }),
          child: childUser({ id: "child-2", studyPt: 2, staminaPt: 0, lifePt: 0 }),
        },
      ],
    };
    mockPrisma.taskTemplate.findFirst.mockResolvedValue(taskWithQuests);

    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ id: "child-2", studyPt: 2, staminaPt: 0, lifePt: 0 })
    );
    mockPrisma.user.update.mockResolvedValue(childUser());
    mockPrisma.questInstance.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.taskTemplate.update.mockResolvedValue(taskTemplate());

    await DELETE(makeRequest("/api/tasks/t3", {}), makeParams("t3"));

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-2" },
      data: {
        studyPt: 2,
        staminaPt: 0, // Math.max(0, 0-1) = 0
        lifePt: 0,
      },
    });
  });

  // IDOR 対策 (PARENT 経路):
  // 現状 `findUnique({ where: { id } })` / `update({ where: { id } })` に family フィルタが
  // なく、親A が他 family のタスク ID を渡すと XP 剥奪 + REJECTED 反映が通ってしまう。
  // findUnique を family スコープ付きに変え、対象なしなら 404 を返す。
  it("親が他 family のタスクを削除しようとしても 404 を返す（IDOR 防止）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    // 他 family のタスクは findFirst で null を返す
    mockPrisma.taskTemplate.findFirst.mockResolvedValue(null);

    const res = await DELETE(
      makeRequest("/api/tasks/other-family-task", {}),
      makeParams("other-family-task"),
    );
    expect(res.status).toBe(404);
    // XP 差し引き・ステータス更新・soft-delete いずれも走らない
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.questInstance.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.taskTemplate.update).not.toHaveBeenCalled();
  });

  // 親が familyId を持たない不整合状態でも DELETE を通してはいけない (Deep defense)
  it("PARENT で familyId=null の場合 403 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));

    const res = await DELETE(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    expect(res.status).toBe(403);
    expect(mockPrisma.taskTemplate.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.taskTemplate.findUnique).not.toHaveBeenCalled();
  });
});

// ─── IDOR 深層防御 (PATCH) ─────────────────────────
describe("PATCH /api/tasks/[id] - IDOR 防御", () => {
  it("PARENT で familyId=null の場合 403 を返す (WHERE 句無効化 → 全件マッチ攻撃を防ぐ)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    const res = await PATCH(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    expect(res.status).toBe(403);
    expect(mockPrisma.taskTemplate.update).not.toHaveBeenCalled();
  });
});
