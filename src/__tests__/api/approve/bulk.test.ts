import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { POST } from "@/app/api/approve/bulk/route";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest } from "../../helpers/request";
import { prismaMock } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, questWithTemplateAndChild } from "../../helpers/fixtures";

vi.mock("@/lib/streak", () => ({
  recordDailyAchievement: vi.fn().mockResolvedValue(undefined),
  recordTaskStreak: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/badges", () => ({
  checkAndUnlockBadges: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/treasureService", () => ({
  unlockTreasuresOnApprove: vi.fn().mockResolvedValue(0),
  cancelTreasuresOnReject: vi.fn().mockResolvedValue(0),
}));

const mockGetCurrentUser = vi.mocked(getCurrentUser);

const makeQuest = (
  id: string,
  childId = "child-1",
  category: "STUDY" | "STAMINA" | "LIFE" = "STUDY",
): Prisma.QuestInstanceGetPayload<{ include: { template: true; child: true } }> =>
  questWithTemplateAndChild(
    {
      id,
      date: new Date("2026-03-30"),
      childId,
      templateId: `tpl-${id}`,
      status: "REPORTED",
      deadlineBonusEarned: false,
      photoUrl: null,
    },
    {
      id: `tpl-${id}`,
      category,
      createdBy: "PARENT",
      photoBonus: false,
      isTemporary: false,
    },
    {
      id: childId,
      evolutionStage: 1,
      evolutionPath: "STUDY",
      collectedPaths: "[]",
      studyPt: 0,
      staminaPt: 0,
      lifePt: 0,
    },
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/approve/bulk", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/approve/bulk", { ids: ["q1"] }));
    expect(res.status).toBe(403);
  });

  it("CHILDロールの場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await POST(makeRequest("/api/approve/bulk", { ids: ["q1"] }));
    expect(res.status).toBe(403);
  });

  it("idsが空配列の場合、count:0で返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await POST(makeRequest("/api/approve/bulk", { ids: [] }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, count: 0 });
  });

  it("複数クエストを順次承認しcount件数を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

    const q1 = makeQuest("q1");
    const q2 = makeQuest("q2");

    // 順次処理のため、2回目のfindUniqueはq1承認後の最新値を返す
    prismaMock.questInstance.findUnique
      .mockResolvedValueOnce(q1)
      .mockResolvedValueOnce(q2);
    // approveQuestInstance内のuser.findUnique（最新child取得）
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ ...q1.child, studyPt: 0 })  // q1承認時
      .mockResolvedValueOnce({ ...q2.child, studyPt: 1 }); // q2承認時（q1の+1が反映済み）
    prismaMock.questInstance.update.mockResolvedValue(q1);
    prismaMock.user.update.mockResolvedValue(q1.child);

    const res = await POST(makeRequest("/api/approve/bulk", { ids: ["q1", "q2"] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, count: 2 });
    // 2件のクエストが承認されること
    expect(prismaMock.questInstance.update).toHaveBeenCalledTimes(2);
    expect(prismaMock.questInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "q1" }, data: expect.objectContaining({ status: "APPROVED" }) })
    );
    expect(prismaMock.questInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "q2" }, data: expect.objectContaining({ status: "APPROVED" }) })
    );
  });

  it("順次処理により2件目のXPが1件目の承認後の値を参照すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

    const q1 = makeQuest("q1");
    const q2 = makeQuest("q2");

    prismaMock.questInstance.findUnique
      .mockResolvedValueOnce(q1)
      .mockResolvedValueOnce(q2);

    // q1承認時: studyPt=0、q2承認時: studyPt=1（q1の+1が反映済みのDBから取得）
    prismaMock.user.findUnique
      .mockResolvedValueOnce({ ...q1.child, studyPt: 0 })
      .mockResolvedValueOnce({ ...q2.child, studyPt: 1 });
    prismaMock.questInstance.update.mockResolvedValue(q1);
    prismaMock.user.update.mockResolvedValue(q1.child);

    await POST(makeRequest("/api/approve/bulk", { ids: ["q1", "q2"] }));

    // 1件目: studyPt 0+1=1
    expect(prismaMock.user.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "child-1" },
        data: expect.objectContaining({ studyPt: 1 }),
      })
    );
    // 2件目: studyPt 1+1=2（並列なら0+1=1になってしまう）
    expect(prismaMock.user.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "child-1" },
        data: expect.objectContaining({ studyPt: 2 }),
      })
    );
  });

  it("存在しないクエストIDはスキップして続行すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

    const q2 = makeQuest("q2");
    prismaMock.questInstance.findUnique
      .mockResolvedValueOnce(null) // q-none は存在しない
      .mockResolvedValueOnce(q2);
    prismaMock.user.findUnique.mockResolvedValue(q2.child);
    prismaMock.questInstance.update.mockResolvedValue(q2);
    prismaMock.user.update.mockResolvedValue(q2.child);

    const res = await POST(makeRequest("/api/approve/bulk", { ids: ["q-none", "q2"] }));
    const json = await res.json();

    expect(json).toEqual({ ok: true, count: 1 });
  });

  it("SKIP_REPORTEDクエストもまとめて承認できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

    const skipQuest = {
      ...makeQuest("q-skip"),
      status: "SKIP_REPORTED" as const,
    };

    prismaMock.questInstance.findUnique.mockResolvedValue(skipQuest);
    prismaMock.questInstance.update.mockResolvedValue(skipQuest);

    const res = await POST(makeRequest("/api/approve/bulk", { ids: ["q-skip"] }));
    const json = await res.json();

    expect(json).toEqual({ ok: true, count: 1 });
    expect(prismaMock.questInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "q-skip" }, data: expect.objectContaining({ status: "SKIPPED" }) })
    );
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
