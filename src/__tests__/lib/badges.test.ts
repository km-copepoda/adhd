import { describe, it, expect } from "vitest";
import { checkBadgeConditions, type BadgeContext } from "@/lib/badges";

// デフォルトコンテキスト（全条件が未達成の状態）
const defaultCtx: BadgeContext = {
  evolutionStage: 0,
  rebirthCount: 0,
  totalXp: 0,
  collectionCount: 0,
  hasStudyCollection: false,
  hasStaminaCollection: false,
  hasLifeCollection: false,
  hasAllTypesCollection: false,
  bestTaskStreak: 0,
  loginCurrentStreak: 0,
  loginBestStreak: 0,
  approvedCount: 0,
  photoCount: 0,
  deadlineBonusCount: 0,
  quickReportCount: 0,
  morningReportCount: 0,
  afternoonReportCount: 0,
  retrySuccessCount: 0,
  skipCount: 0,
  skipThenNextDayCount: 0,
  perfectDaysCount: 0,
  maxQuestsPerDay: 0,
  weeksWithFivePlusDays: 0,
  weeksWithSevenDays: 0,
  monthsWithTenPlusDays: 0,
  monthsWithFifteenPlusDays: 0,
  monthsWithTwentyPlusDays: 0,
  perfectMonthsCount: 0,
  springDays: 0,
  summerDays: 0,
  autumnDays: 0,
  winterDays: 0,
  hasNewYearQuest: false,
  monthEndCount: 0,
  mondayCount: 0,
  weekendCount: 0,
  selfTaskCreatedCount: 0,
  selfTaskApprovedCount: 0,
  maxSingleTaskBestStreak: 0,
  hasComeback7: false,
  hasComeback14: false,
  hasComeback7After2Breaks: false,
  hasMagicDay: false,
  hasWeekWithDailyDeadline: false,
  tripleCrownDaysCount: 0,
  unlockedBadgeCount: 0,
};

function ctx(overrides: Partial<BadgeContext>): BadgeContext {
  return { ...defaultCtx, ...overrides };
}

describe("checkBadgeConditions", () => {
  // ─── はじめて系 ─────────────────────────────────────────
  describe("first_hatch (#1)", () => {
    it("evolutionStage >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ evolutionStage: 1 })).has("first_hatch")).toBe(true);
      expect(checkBadgeConditions(ctx({ evolutionStage: 3 })).has("first_hatch")).toBe(true);
    });
    it("転生済み（rebirthCount >= 1）でも解除", () => {
      expect(checkBadgeConditions(ctx({ rebirthCount: 1 })).has("first_hatch")).toBe(true);
    });
    it("evolutionStage=0 かつ rebirthCount=0 なら未解除", () => {
      expect(checkBadgeConditions(ctx({})).has("first_hatch")).toBe(false);
    });
  });

  describe("first_quest (#2)", () => {
    it("approvedCount >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ approvedCount: 1 })).has("first_quest")).toBe(true);
    });
    it("approvedCount = 0 なら未解除", () => {
      expect(checkBadgeConditions(ctx({})).has("first_quest")).toBe(false);
    });
  });

  describe("first_photo (#4)", () => {
    it("photoCount >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ photoCount: 1 })).has("first_photo")).toBe(true);
    });
    it("photoCount = 0 なら未解除", () => {
      expect(checkBadgeConditions(ctx({})).has("first_photo")).toBe(false);
    });
  });

  describe("first_self_task (#5)", () => {
    it("selfTaskCreatedCount >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ selfTaskCreatedCount: 1 })).has("first_self_task")).toBe(true);
    });
  });

  describe("first_self_approved (#6)", () => {
    it("selfTaskApprovedCount >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ selfTaskApprovedCount: 1 })).has("first_self_approved")).toBe(true);
    });
  });

  describe("first_skip (#7)", () => {
    it("skipCount >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ skipCount: 1 })).has("first_skip")).toBe(true);
    });
  });

  describe("first_retry (#8)", () => {
    it("retrySuccessCount >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ retrySuccessCount: 1 })).has("first_retry")).toBe(true);
    });
  });

  describe("first_evo2 (#9)", () => {
    it("evolutionStage >= 2 で解除", () => {
      expect(checkBadgeConditions(ctx({ evolutionStage: 2 })).has("first_evo2")).toBe(true);
    });
    it("転生済み（rebirthCount >= 1）でも解除", () => {
      expect(checkBadgeConditions(ctx({ rebirthCount: 1 })).has("first_evo2")).toBe(true);
    });
    it("evolutionStage=1 かつ rebirthCount=0 では未解除", () => {
      expect(checkBadgeConditions(ctx({ evolutionStage: 1 })).has("first_evo2")).toBe(false);
    });
  });

  describe("first_evo3 (#10)", () => {
    it("evolutionStage = 3 で解除", () => {
      expect(checkBadgeConditions(ctx({ evolutionStage: 3 })).has("first_evo3")).toBe(true);
    });
    it("転生済みで解除", () => {
      expect(checkBadgeConditions(ctx({ rebirthCount: 1 })).has("first_evo3")).toBe(true);
    });
    it("evolutionStage = 2 かつ rebirthCount=0 では未解除", () => {
      expect(checkBadgeConditions(ctx({ evolutionStage: 2 })).has("first_evo3")).toBe(false);
    });
  });

  // ─── タスクストリーク系 ────────────────────────────────
  describe("streak_3 (#11)", () => {
    it("bestTaskStreak >= 3 で解除", () => {
      expect(checkBadgeConditions(ctx({ bestTaskStreak: 3 })).has("streak_3")).toBe(true);
    });
    it("bestTaskStreak = 2 では未解除", () => {
      expect(checkBadgeConditions(ctx({ bestTaskStreak: 2 })).has("streak_3")).toBe(false);
    });
  });

  describe("streak_30 (#15)", () => {
    it("bestTaskStreak >= 30 で解除", () => {
      expect(checkBadgeConditions(ctx({ bestTaskStreak: 30 })).has("streak_30")).toBe(true);
      expect(checkBadgeConditions(ctx({ bestTaskStreak: 29 })).has("streak_30")).toBe(false);
    });
  });

  describe("streak_comeback (#16)", () => {
    it("hasComeback7=true で解除", () => {
      expect(checkBadgeConditions(ctx({ hasComeback7: true })).has("streak_comeback")).toBe(true);
    });
    it("hasComeback7=false なら未解除", () => {
      expect(checkBadgeConditions(ctx({})).has("streak_comeback")).toBe(false);
    });
  });

  // ─── ログインストリーク系 ────────────────────────────────
  describe("login_7 (#18)", () => {
    it("loginBestStreak >= 7 で解除", () => {
      expect(checkBadgeConditions(ctx({ loginBestStreak: 7 })).has("login_7")).toBe(true);
      expect(checkBadgeConditions(ctx({ loginBestStreak: 6 })).has("login_7")).toBe(false);
    });
  });

  describe("login_morning7 (#21)", () => {
    it("morningReportCount >= 7 で解除", () => {
      expect(checkBadgeConditions(ctx({ morningReportCount: 7 })).has("login_morning7")).toBe(true);
      expect(checkBadgeConditions(ctx({ morningReportCount: 6 })).has("login_morning7")).toBe(false);
    });
  });

  // ─── クエスト数系 ─────────────────────────────────────
  describe("quest_10 (#22)", () => {
    it("approvedCount >= 10 で解除", () => {
      expect(checkBadgeConditions(ctx({ approvedCount: 10 })).has("quest_10")).toBe(true);
      expect(checkBadgeConditions(ctx({ approvedCount: 9 })).has("quest_10")).toBe(false);
    });
  });

  describe("quest_300 (#27)", () => {
    it("approvedCount >= 300 で解除", () => {
      expect(checkBadgeConditions(ctx({ approvedCount: 300 })).has("quest_300")).toBe(true);
      expect(checkBadgeConditions(ctx({ approvedCount: 299 })).has("quest_300")).toBe(false);
    });
  });

  // ─── XP系 ───────────────────────────────────────────
  describe("xp_10 (#33)", () => {
    it("totalXp >= 10 で解除", () => {
      expect(checkBadgeConditions(ctx({ totalXp: 10 })).has("xp_10")).toBe(true);
      expect(checkBadgeConditions(ctx({ totalXp: 9 })).has("xp_10")).toBe(false);
    });
  });

  // ─── 写真系 ─────────────────────────────────────────
  describe("photo_5 (#38)", () => {
    it("photoCount >= 5 で解除", () => {
      expect(checkBadgeConditions(ctx({ photoCount: 5 })).has("photo_5")).toBe(true);
      expect(checkBadgeConditions(ctx({ photoCount: 4 })).has("photo_5")).toBe(false);
    });
  });

  describe("photo_100 (#41)", () => {
    it("photoCount >= 100 で解除", () => {
      expect(checkBadgeConditions(ctx({ photoCount: 100 })).has("photo_100")).toBe(true);
      expect(checkBadgeConditions(ctx({ photoCount: 99 })).has("photo_100")).toBe(false);
    });
  });

  // ─── 期限ボーナス系 ──────────────────────────────────
  describe("deadline_first (#42)", () => {
    it("deadlineBonusCount >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ deadlineBonusCount: 1 })).has("deadline_first")).toBe(true);
    });
  });

  describe("deadline_50 (#45)", () => {
    it("deadlineBonusCount >= 50 で解除", () => {
      expect(checkBadgeConditions(ctx({ deadlineBonusCount: 50 })).has("deadline_50")).toBe(true);
      expect(checkBadgeConditions(ctx({ deadlineBonusCount: 49 })).has("deadline_50")).toBe(false);
    });
  });

  // ─── 時間帯系 ────────────────────────────────────────
  describe("morning_first (#46)", () => {
    it("morningReportCount >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ morningReportCount: 1 })).has("morning_first")).toBe(true);
    });
  });

  describe("morning_7 (#47)", () => {
    it("morningReportCount >= 7 で解除", () => {
      expect(checkBadgeConditions(ctx({ morningReportCount: 7 })).has("morning_7")).toBe(true);
      expect(checkBadgeConditions(ctx({ morningReportCount: 6 })).has("morning_7")).toBe(false);
    });
  });

  describe("afternoon_first (#48)", () => {
    it("afternoonReportCount >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ afternoonReportCount: 1 })).has("afternoon_first")).toBe(true);
    });
  });

  describe("afternoon_10 (#49)", () => {
    it("afternoonReportCount >= 10 で解除", () => {
      expect(checkBadgeConditions(ctx({ afternoonReportCount: 10 })).has("afternoon_10")).toBe(true);
      expect(checkBadgeConditions(ctx({ afternoonReportCount: 9 })).has("afternoon_10")).toBe(false);
    });
  });

  describe("quick_first (#50)", () => {
    it("quickReportCount >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ quickReportCount: 1 })).has("quick_first")).toBe(true);
    });
  });

  describe("quick_10 (#51)", () => {
    it("quickReportCount >= 10 で解除", () => {
      expect(checkBadgeConditions(ctx({ quickReportCount: 10 })).has("quick_10")).toBe(true);
      expect(checkBadgeConditions(ctx({ quickReportCount: 9 })).has("quick_10")).toBe(false);
    });
  });

  // ─── 1日の達成系 ─────────────────────────────────────
  describe("perfect_first (#52)", () => {
    it("perfectDaysCount >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ perfectDaysCount: 1 })).has("perfect_first")).toBe(true);
    });
  });

  describe("perfect_15 (#54)", () => {
    it("perfectDaysCount >= 15 で解除", () => {
      expect(checkBadgeConditions(ctx({ perfectDaysCount: 15 })).has("perfect_15")).toBe(true);
      expect(checkBadgeConditions(ctx({ perfectDaysCount: 14 })).has("perfect_15")).toBe(false);
    });
  });

  describe("day_3quests (#55)", () => {
    it("maxQuestsPerDay >= 3 で解除", () => {
      expect(checkBadgeConditions(ctx({ maxQuestsPerDay: 3 })).has("day_3quests")).toBe(true);
      expect(checkBadgeConditions(ctx({ maxQuestsPerDay: 2 })).has("day_3quests")).toBe(false);
    });
  });

  describe("day_5quests (#56)", () => {
    it("maxQuestsPerDay >= 5 で解除", () => {
      expect(checkBadgeConditions(ctx({ maxQuestsPerDay: 5 })).has("day_5quests")).toBe(true);
      expect(checkBadgeConditions(ctx({ maxQuestsPerDay: 4 })).has("day_5quests")).toBe(false);
    });
  });

  // ─── 週・月の達成系 ──────────────────────────────────
  describe("week_5 (#57)", () => {
    it("weeksWithFivePlusDays >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ weeksWithFivePlusDays: 1 })).has("week_5")).toBe(true);
    });
  });

  describe("week_7 (#59)", () => {
    it("weeksWithSevenDays >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ weeksWithSevenDays: 1 })).has("week_7")).toBe(true);
    });
  });

  describe("month_perfect (#64)", () => {
    it("perfectMonthsCount >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ perfectMonthsCount: 1 })).has("month_perfect")).toBe(true);
    });
  });

  // ─── 転生系 ─────────────────────────────────────────
  describe("rebirth_1 (#65)", () => {
    it("rebirthCount >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ rebirthCount: 1 })).has("rebirth_1")).toBe(true);
      expect(checkBadgeConditions(ctx({})).has("rebirth_1")).toBe(false);
    });
  });

  describe("rebirth_7 (#69)", () => {
    it("rebirthCount >= 7 で解除", () => {
      expect(checkBadgeConditions(ctx({ rebirthCount: 7 })).has("rebirth_7")).toBe(true);
      expect(checkBadgeConditions(ctx({ rebirthCount: 6 })).has("rebirth_7")).toBe(false);
    });
  });

  // ─── コレクション系 ──────────────────────────────────
  describe("collection_3 (#70)", () => {
    it("collectionCount >= 3 で解除", () => {
      expect(checkBadgeConditions(ctx({ collectionCount: 3 })).has("collection_3")).toBe(true);
      expect(checkBadgeConditions(ctx({ collectionCount: 2 })).has("collection_3")).toBe(false);
    });
  });

  describe("collection_study (#72)", () => {
    it("hasStudyCollection で解除", () => {
      expect(checkBadgeConditions(ctx({ hasStudyCollection: true })).has("collection_study")).toBe(true);
      expect(checkBadgeConditions(ctx({})).has("collection_study")).toBe(false);
    });
  });

  describe("collection_all (#75)", () => {
    it("hasAllTypesCollection で解除", () => {
      expect(checkBadgeConditions(ctx({ hasAllTypesCollection: true })).has("collection_all")).toBe(true);
      expect(checkBadgeConditions(ctx({ hasStudyCollection: true, hasStaminaCollection: true })).has("collection_all")).toBe(false);
    });
  });

  // ─── 自発性・粘り強さ系 ──────────────────────────────
  describe("self_task_3 (#76)", () => {
    it("selfTaskApprovedCount >= 3 で解除", () => {
      expect(checkBadgeConditions(ctx({ selfTaskApprovedCount: 3 })).has("self_task_3")).toBe(true);
      expect(checkBadgeConditions(ctx({ selfTaskApprovedCount: 2 })).has("self_task_3")).toBe(false);
    });
  });

  describe("habit_14 (#79)", () => {
    it("maxSingleTaskBestStreak >= 14 で解除", () => {
      expect(checkBadgeConditions(ctx({ maxSingleTaskBestStreak: 14 })).has("habit_14")).toBe(true);
      expect(checkBadgeConditions(ctx({ maxSingleTaskBestStreak: 13 })).has("habit_14")).toBe(false);
    });
  });

  describe("habit_30 (#80)", () => {
    it("maxSingleTaskBestStreak >= 30 で解除", () => {
      expect(checkBadgeConditions(ctx({ maxSingleTaskBestStreak: 30 })).has("habit_30")).toBe(true);
      expect(checkBadgeConditions(ctx({ maxSingleTaskBestStreak: 29 })).has("habit_30")).toBe(false);
    });
  });

  describe("skip_recovery (#81)", () => {
    it("skipThenNextDayCount >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ skipThenNextDayCount: 1 })).has("skip_recovery")).toBe(true);
    });
  });

  describe("skip_aware (#82)", () => {
    it("skipCount >= 5 で解除", () => {
      expect(checkBadgeConditions(ctx({ skipCount: 5 })).has("skip_aware")).toBe(true);
      expect(checkBadgeConditions(ctx({ skipCount: 4 })).has("skip_aware")).toBe(false);
    });
  });

  describe("retry_5 (#83)", () => {
    it("retrySuccessCount >= 5 で解除", () => {
      expect(checkBadgeConditions(ctx({ retrySuccessCount: 5 })).has("retry_5")).toBe(true);
      expect(checkBadgeConditions(ctx({ retrySuccessCount: 4 })).has("retry_5")).toBe(false);
    });
  });

  // ─── 曜日・季節系 ────────────────────────────────────
  describe("monday_5 (#84)", () => {
    it("mondayCount >= 5 で解除", () => {
      expect(checkBadgeConditions(ctx({ mondayCount: 5 })).has("monday_5")).toBe(true);
      expect(checkBadgeConditions(ctx({ mondayCount: 4 })).has("monday_5")).toBe(false);
    });
  });

  describe("weekend_10 (#85)", () => {
    it("weekendCount >= 10 で解除", () => {
      expect(checkBadgeConditions(ctx({ weekendCount: 10 })).has("weekend_10")).toBe(true);
      expect(checkBadgeConditions(ctx({ weekendCount: 9 })).has("weekend_10")).toBe(false);
    });
  });

  describe("spring (#86)", () => {
    it("springDays >= 10 で解除", () => {
      expect(checkBadgeConditions(ctx({ springDays: 10 })).has("spring")).toBe(true);
      expect(checkBadgeConditions(ctx({ springDays: 9 })).has("spring")).toBe(false);
    });
  });

  describe("newyear (#90)", () => {
    it("hasNewYearQuest=true で解除", () => {
      expect(checkBadgeConditions(ctx({ hasNewYearQuest: true })).has("newyear")).toBe(true);
    });
  });

  describe("month_end (#91)", () => {
    it("monthEndCount >= 5 で解除", () => {
      expect(checkBadgeConditions(ctx({ monthEndCount: 5 })).has("month_end")).toBe(true);
      expect(checkBadgeConditions(ctx({ monthEndCount: 4 })).has("month_end")).toBe(false);
    });
  });

  // ─── マイルストーン系 ────────────────────────────────
  describe("milestone_10 (#92)", () => {
    it("unlockedBadgeCount >= 10 で解除", () => {
      expect(checkBadgeConditions(ctx({ unlockedBadgeCount: 10 })).has("milestone_10")).toBe(true);
      expect(checkBadgeConditions(ctx({ unlockedBadgeCount: 9 })).has("milestone_10")).toBe(false);
    });
  });

  describe("milestone_75 (#95)", () => {
    it("unlockedBadgeCount >= 75 で解除", () => {
      expect(checkBadgeConditions(ctx({ unlockedBadgeCount: 75 })).has("milestone_75")).toBe(true);
      expect(checkBadgeConditions(ctx({ unlockedBadgeCount: 74 })).has("milestone_75")).toBe(false);
    });
  });

  // ─── 複合チャレンジ系 ────────────────────────────────
  describe("comeback_7x2 (#96)", () => {
    it("hasComeback7After2Breaks=true で解除", () => {
      expect(checkBadgeConditions(ctx({ hasComeback7After2Breaks: true })).has("comeback_7x2")).toBe(true);
    });
  });

  describe("multi_tasker (#97)", () => {
    it("hasMagicDay=true で解除", () => {
      expect(checkBadgeConditions(ctx({ hasMagicDay: true })).has("multi_tasker")).toBe(true);
    });
  });

  describe("speed_star (#98)", () => {
    it("hasWeekWithDailyDeadline=true で解除", () => {
      expect(checkBadgeConditions(ctx({ hasWeekWithDailyDeadline: true })).has("speed_star")).toBe(true);
    });
  });

  describe("triple_crown (#99)", () => {
    it("tripleCrownDaysCount >= 10 で解除", () => {
      expect(checkBadgeConditions(ctx({ tripleCrownDaysCount: 10 })).has("triple_crown")).toBe(true);
      expect(checkBadgeConditions(ctx({ tripleCrownDaysCount: 9 })).has("triple_crown")).toBe(false);
    });
  });

  describe("comeback_14 (#100)", () => {
    it("hasComeback14=true で解除", () => {
      expect(checkBadgeConditions(ctx({ hasComeback14: true })).has("comeback_14")).toBe(true);
    });
  });

  // ─── 複数バッジ同時解除 ──────────────────────────────
  it("複数条件を同時に満たした場合、複数バッジを解除", () => {
    const earned = checkBadgeConditions(ctx({
      approvedCount: 10,
      photoCount: 5,
      bestTaskStreak: 7,
    }));
    expect(earned.has("quest_10")).toBe(true);
    expect(earned.has("approval_10")).toBe(true);
    expect(earned.has("photo_5")).toBe(true);
    expect(earned.has("streak_7")).toBe(true);
    expect(earned.has("first_quest")).toBe(true);
  });

  // ─── 全バッジ数チェック ──────────────────────────────
  it("ALL_BADGES は100個である", async () => {
    const { ALL_BADGES } = await import("@/lib/badges");
    expect(ALL_BADGES).toHaveLength(100);
  });

  it("全バッジIDがユニーク", async () => {
    const { ALL_BADGES } = await import("@/lib/badges");
    const ids = ALL_BADGES.map(b => b.id);
    expect(new Set(ids).size).toBe(100);
  });
});
