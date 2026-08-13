import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentUser } from "@/lib/auth";
import { checkAndUnlockBadges } from "@/lib/badges";
import type { Badge, BadgeProgress } from "@/lib/badges";
import { triggerBadgeLog } from "@/lib/bulletinLog";
import { GET } from "@/app/api/badges/route";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { childUserWithFamily, parentUserWithFamily, userBadge } from "../../helpers/fixtures";

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

type BadgeResponseItem = Badge & {
  unlocked: boolean;
  unlockedAt: Date | null;
  isNew: boolean;
  progress: BadgeProgress | null;
};

type BadgesResponse = {
  badges: BadgeResponseItem[];
  unlockedCount: number;
  totalCount: number;
  newlyUnlocked: string[];
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.userBadge.findMany.mockResolvedValue([]);
});

describe("GET /api/badges", () => {
  it("子供以外（親 or 未認証）は 403", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await GET();
    expect(res.status).toBe(403);

    mockGetCurrentUser.mockResolvedValue(null);
    const res2 = await GET();
    expect(res2.status).toBe(403);
  });

  it("新規解除されたバッジを掲示板に流す（triggerBadgeLog 呼び出し）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockCheckAndUnlockBadges.mockResolvedValue([
      { id: "first_step", name: "はじめの一歩", emoji: "🌱", description: "..." },
      { id: "login_14", name: "2週間ログイン", emoji: "🌿", description: "..." },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    await new Promise((r) => setImmediate(r));

    expect(mockTriggerBadgeLog).toHaveBeenCalledTimes(2);
    expect(mockTriggerBadgeLog).toHaveBeenCalledWith("child-1", "はじめの一歩");
    expect(mockTriggerBadgeLog).toHaveBeenCalledWith("child-1", "2週間ログイン");
  });

  it("新規解除がなければ triggerBadgeLog は呼ばれない", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockCheckAndUnlockBadges.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    await new Promise((r) => setImmediate(r));

    expect(mockTriggerBadgeLog).not.toHaveBeenCalled();
  });

  it("UserBadge に廃止された旧ID が残っていても unlockedCount は ALL_BADGES の ID のみ数える", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockCheckAndUnlockBadges.mockResolvedValue([]);
    mockPrisma.userBadge.findMany.mockResolvedValue([
      userBadge({ id: "ub-1", badgeId: "first_quest", unlockedAt: new Date("2026-06-01") }),
      userBadge({ id: "ub-2", badgeId: "first_approval", unlockedAt: new Date("2026-04-10") }), // 廃止ID
      userBadge({ id: "ub-3", badgeId: "streak_3", unlockedAt: new Date("2026-04-11") }),       // 廃止ID
      userBadge({ id: "ub-4", badgeId: "xp_10", unlockedAt: new Date("2026-04-12") }),          // 廃止ID
    ]);

    const res = await GET();
    const json = (await res.json()) as BadgesResponse;
    expect(res.status).toBe(200);
    expect(json.unlockedCount).toBe(1);
    expect(json.totalCount).toBe(100);
    // 旧IDのバッジは badges 配列に含まれない（ALL_BADGES ベース描画）
    const ids = json.badges.map((b) => b.id);
    expect(ids).not.toContain("first_approval");
    expect(ids).not.toContain("streak_3");
    expect(ids).not.toContain("xp_10");
  });

  it("レスポンスの各バッジに progress フィールドを含む（数値系は {current,target}、ブール系は null）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await GET();
    const json = (await res.json()) as BadgesResponse;
    expect(res.status).toBe(200);
    expect(Array.isArray(json.badges)).toBe(true);

    const questBadge = json.badges.find((b) => b.id === "quest_10");
    expect(questBadge).toBeDefined();
    expect(questBadge?.progress).toEqual({ current: 0, target: 10 });

    const collectionAll = json.badges.find((b) => b.id === "collection_all");
    expect(collectionAll).toBeDefined();
    expect(collectionAll?.progress).toBeNull();
  });
});
