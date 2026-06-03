import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkAndUnlockBadges } from "@/lib/badges";
import { triggerBadgeLog } from "@/lib/bulletinLog";
import { GET } from "@/app/api/badges/route";
import { childUser, parentUser } from "../../helpers/fixtures";

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

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockCheckAndUnlockBadges = vi.mocked(checkAndUnlockBadges);
const mockTriggerBadgeLog = vi.mocked(triggerBadgeLog);

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.userBadge.findMany.mockResolvedValue([]);
});

describe("GET /api/badges", () => {
  it("子供以外（親 or 未認証）は 403", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await GET();
    expect(res.status).toBe(403);

    mockGetCurrentUser.mockResolvedValue(null);
    const res2 = await GET();
    expect(res2.status).toBe(403);
  });

  it("新規解除されたバッジを掲示板に流す（triggerBadgeLog 呼び出し）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
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
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockCheckAndUnlockBadges.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    await new Promise((r) => setImmediate(r));

    expect(mockTriggerBadgeLog).not.toHaveBeenCalled();
  });

  it("レスポンスの各バッジに progress フィールドを含む（数値系は {current,target}、ブール系は null）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(json.badges)).toBe(true);

    const questBadge = json.badges.find((b: any) => b.id === "quest_10");
    expect(questBadge).toBeDefined();
    expect(questBadge.progress).toEqual({ current: 0, target: 10 });

    const collectionAll = json.badges.find((b: any) => b.id === "collection_all");
    expect(collectionAll).toBeDefined();
    expect(collectionAll.progress).toBeNull();
  });
});
