import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/approve/bulk/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest } from "../../helpers/request";
import { parentUser, childUser } from "../../helpers/fixtures";

vi.mock("@/lib/streak", () => ({
  recordDailyAchievement: vi.fn().mockResolvedValue(undefined),
  recordTaskStreak: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/badges", () => ({
  checkAndUnlockBadges: vi.fn().mockResolvedValue([]),
}));

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

const makeQuest = (id: string, childId = "child-1", category = "STUDY") => ({
  id,
  date: new Date("2026-03-30"),
  childId,
  templateId: `tpl-${id}`,
  status: "REPORTED" as const,
  deadlineBonusEarned: false,
  photoUrl: null,
  template: {
    id: `tpl-${id}`,
    category: category as "STUDY" | "STAMINA" | "LIFE",
    createdBy: "PARENT" as const,
    photoBonus: false,
    isTemporary: false,
  },
  child: {
    id: childId,
    evolutionStage: 1,
    evolutionPath: "STUDY",
    collectedPaths: "[]",
    studyPt: 0,
    staminaPt: 0,
    lifePt: 0,
  },
});

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
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await POST(makeRequest("/api/approve/bulk", { ids: ["q1"] }));
    expect(res.status).toBe(403);
  });

  it("idsが空配列の場合、count:0で返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await POST(makeRequest("/api/approve/bulk", { ids: [] }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, count: 0 });
  });

  it("複数クエストを順次承認しcount件数を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);

    const q1 = makeQuest("q1");
    const q2 = makeQuest("q2");

    // 順次処理のため、2回目のfindUniqueはq1承認後の最新値を返す
    mockPrisma.questInstance.findUnique
      .mockResolvedValueOnce(q1 as any)
      .mockResolvedValueOnce(q2 as any);
    // approveQuestInstance内のuser.findUnique（最新child取得）
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...q1.child, studyPt: 0 } as any)  // q1承認時
      .mockResolvedValueOnce({ ...q2.child, studyPt: 1 } as any); // q2承認時（q1の+1が反映済み）
    mockPrisma.questInstance.update.mockResolvedValue({} as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    const res = await POST(makeRequest("/api/approve/bulk", { ids: ["q1", "q2"] }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, count: 2 });
    // 2件のクエストが承認されること
    expect(mockPrisma.questInstance.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "q1" }, data: expect.objectContaining({ status: "APPROVED" }) })
    );
    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "q2" }, data: expect.objectContaining({ status: "APPROVED" }) })
    );
  });

  it("順次処理により2件目のXPが1件目の承認後の値を参照すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);

    const q1 = makeQuest("q1");
    const q2 = makeQuest("q2");

    mockPrisma.questInstance.findUnique
      .mockResolvedValueOnce(q1 as any)
      .mockResolvedValueOnce(q2 as any);

    // q1承認時: studyPt=0、q2承認時: studyPt=1（q1の+1が反映済みのDBから取得）
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ ...q1.child, studyPt: 0 } as any)
      .mockResolvedValueOnce({ ...q2.child, studyPt: 1 } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    await POST(makeRequest("/api/approve/bulk", { ids: ["q1", "q2"] }));

    // 1件目: studyPt 0+1=1
    expect(mockPrisma.user.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: "child-1" },
        data: expect.objectContaining({ studyPt: 1 }),
      })
    );
    // 2件目: studyPt 1+1=2（並列なら0+1=1になってしまう）
    expect(mockPrisma.user.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: "child-1" },
        data: expect.objectContaining({ studyPt: 2 }),
      })
    );
  });

  it("存在しないクエストIDはスキップして続行すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);

    mockPrisma.questInstance.findUnique
      .mockResolvedValueOnce(null) // q-none は存在しない
      .mockResolvedValueOnce(makeQuest("q2") as any);
    mockPrisma.user.findUnique.mockResolvedValue({ ...makeQuest("q2").child } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    const res = await POST(makeRequest("/api/approve/bulk", { ids: ["q-none", "q2"] }));
    const json = await res.json();

    expect(json).toEqual({ ok: true, count: 1 });
  });

  it("SKIP_REPORTEDクエストもまとめて承認できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);

    const skipQuest = {
      ...makeQuest("q-skip"),
      status: "SKIP_REPORTED" as const,
    };

    mockPrisma.questInstance.findUnique.mockResolvedValue(skipQuest as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(makeRequest("/api/approve/bulk", { ids: ["q-skip"] }));
    const json = await res.json();

    expect(json).toEqual({ ok: true, count: 1 });
    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "q-skip" }, data: expect.objectContaining({ status: "SKIPPED" }) })
    );
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
