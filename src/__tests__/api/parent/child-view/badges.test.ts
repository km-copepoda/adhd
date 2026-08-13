import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentUser } from "@/lib/auth";
import { checkAndUnlockBadges, type Badge } from "@/lib/badges";
import { triggerBadgeLog } from "@/lib/bulletinLog";
import { GET } from "@/app/api/parent/child-view/badges/route";
import { prismaMock as mockPrisma } from "../../../helpers/prisma-mock";
import { childUserWithFamily, parentUserWithFamily, childUser, userBadge } from "../../../helpers/fixtures";

vi.mock("@/lib/badges", async () => {
  const actual = await vi.importActual<typeof import("@/lib/badges")>("@/lib/badges");
  const emptyCtx = {
    evolutionStage: 0, rebirthCount: 0, totalXp: 0, collectionCount: 0,
    hasStudyCollection: false, hasStaminaCollection: false, hasLifeCollection: false, hasAllTypesCollection: false,
    bestTaskStreak: 0, loginCurrentStreak: 0, loginBestStreak: 0,
    approvedCount: 0, photoCount: 0, deadlineBonusCount: 0, quickReportCount: 0,
    morningReportCount: 0, afternoonReportCount: 0, retrySuccessCount: 0, skipCount: 0, skipThenNextDayCount: 0,
    perfectDaysCount: 0, maxQuestsPerDay: 0,
    weeksWithFivePlusDays: 0, weeksWithSevenDays: 0,
    monthsWithTenPlusDays: 0, monthsWithFifteenPlusDays: 0, monthsWithTwentyPlusDays: 0, perfectMonthsCount: 0,
    springDays: 0, summerDays: 0, autumnDays: 0, winterDays: 0,
    hasNewYearQuest: false, monthEndCount: 0, mondayCount: 0, weekendCount: 0,
    selfTaskCreatedCount: 0, selfTaskApprovedCount: 0, maxSingleTaskBestStreak: 0,
    hasComeback7: false, hasComeback14: false, hasComeback7After2Breaks: false,
    hasMagicDay: false, hasWeekWithDailyDeadline: false, tripleCrownDaysCount: 0,
    unlockedBadgeCount: 0,
    treasureOpenedCount: 0, rareTreasureCount: 0,
    collectionItemCount: 0, collectionSeasonsComplete: 0, hasAllCollectionItems: false,
    rebirthEggUsed: false,
  };
  return {
    ...actual,
    checkAndUnlockBadges: vi.fn().mockResolvedValue([]),
    loadBadgeContext: vi.fn().mockResolvedValue(emptyCtx),
  };
});

vi.mock("@/lib/bulletinLog", () => ({
  triggerBadgeLog: vi.fn().mockResolvedValue(undefined),
}));

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockCheckAndUnlockBadges = vi.mocked(checkAndUnlockBadges);
const mockTriggerBadgeLog = vi.mocked(triggerBadgeLog);

function makeReq(childId?: string) {
  const url = childId !== undefined
    ? `http://localhost/api/parent/child-view/badges?childId=${childId}`
    : "http://localhost/api/parent/child-view/badges";
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.userBadge.findMany.mockResolvedValue([]);
});

describe("GET /api/parent/child-view/badges", () => {
  it("未認証で401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(401);
  });

  it("CHILD ロールで403", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(403);
  });

  it("childId 未指定で400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await GET(makeReq(""));
    expect(res.status).toBe(400);
  });

  it("別 family の子を指定された場合、404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq("child-other"));
    expect(res.status).toBe(404);
  });

  it("正常系: 子供の childId で checkAndUnlockBadges / userBadge.findMany を呼ぶ", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockCheckAndUnlockBadges.mockResolvedValue([]);
    // `select: { badgeId, unlockedAt }` クエリでも mockResolvedValue はベースの UserBadge 完全型を
    // 要求するため、userBadge フィクスチャで完全な値を用意する（select で絞るので余剰フィールドは無視される）。
    const unlocked = [
      userBadge({ badgeId: "first_quest", unlockedAt: new Date("2026-05-01") }),
    ];
    mockPrisma.userBadge.findMany.mockResolvedValue(unlocked);

    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.totalCount).toBeGreaterThan(0);
    expect(json.unlockedCount).toBe(1);
    expect(Array.isArray(json.badges)).toBe(true);

    expect(mockCheckAndUnlockBadges).toHaveBeenCalledWith("child-1");
    const findManyCall = mockPrisma.userBadge.findMany.mock.calls[0][0];
    expect(findManyCall?.where?.userId).toBe("child-1");
  });

  it("UserBadge に廃止された旧ID が残っていても unlockedCount は ALL_BADGES の ID のみ数える", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockCheckAndUnlockBadges.mockResolvedValue([]);
    const unlocked = [
      userBadge({ badgeId: "first_quest", unlockedAt: new Date("2026-06-01") }),
      userBadge({ badgeId: "first_approval", unlockedAt: new Date("2026-04-10") }), // 廃止ID
      userBadge({ badgeId: "streak_3", unlockedAt: new Date("2026-04-11") }),       // 廃止ID
      userBadge({ badgeId: "xp_10", unlockedAt: new Date("2026-04-12") }),          // 廃止ID
    ];
    mockPrisma.userBadge.findMany.mockResolvedValue(unlocked);

    const res = await GET(makeReq("child-1"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.unlockedCount).toBe(1);
    expect(json.totalCount).toBe(100);
    const ids = (json.badges as Array<{ id: string }>).map((b) => b.id);
    expect(ids).not.toContain("first_approval");
    expect(ids).not.toContain("streak_3");
    expect(ids).not.toContain("xp_10");
  });

  it("新規解除されたバッジを掲示板に流す（triggerBadgeLog 呼び出し）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    const newlyUnlocked: Badge[] = [
      { id: "first_step", name: "はじめの一歩", emoji: "🌱", description: "..." },
    ];
    mockCheckAndUnlockBadges.mockResolvedValue(newlyUnlocked);

    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(200);
    await new Promise((r) => setImmediate(r));

    expect(mockTriggerBadgeLog).toHaveBeenCalledWith("child-1", "はじめの一歩");
  });
});
