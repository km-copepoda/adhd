import { describe, it, expect } from "vitest";
import { checkBadgeConditions, ALL_BADGES, type BadgeContext } from "@/lib/badges";

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
  treasureOpenedCount: 0,
  rareTreasureCount: 0,
  collectionItemCount: 0,
  collectionSeasonsComplete: 0,
  hasAllCollectionItems: false,
  rebirthEggUsed: false,
};

function ctx(overrides: Partial<BadgeContext>): BadgeContext {
  return { ...defaultCtx, ...overrides };
}

describe("checkBadgeConditions (2026-06 改訂版: 序盤を絞った100バッジ)", () => {
  // ─── ようこそ系（序盤1-2個のみ） ────────────────────────
  describe("first_quest (#1)", () => {
    it("approvedCount >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ approvedCount: 1 })).has("first_quest")).toBe(true);
      expect(checkBadgeConditions(ctx({})).has("first_quest")).toBe(false);
    });
  });

  describe("first_hatch (#2)", () => {
    it("evolutionStage >= 1 または rebirthCount >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ evolutionStage: 1 })).has("first_hatch")).toBe(true);
      expect(checkBadgeConditions(ctx({ rebirthCount: 1 })).has("first_hatch")).toBe(true);
      expect(checkBadgeConditions(ctx({})).has("first_hatch")).toBe(false);
    });
  });

  describe("first_self_approved (#3)", () => {
    it("selfTaskApprovedCount >= 1 で解除", () => {
      expect(checkBadgeConditions(ctx({ selfTaskApprovedCount: 1 })).has("first_self_approved")).toBe(true);
      expect(checkBadgeConditions(ctx({})).has("first_self_approved")).toBe(false);
    });
  });

  describe("廃止された序盤バッジは存在しない", () => {
    const removed = [
      "first_approval", "first_photo", "first_self_task", "first_skip", "first_retry",
      "first_evo2", "first_evo3",
      "deadline_first", "morning_first", "afternoon_first", "quick_first", "perfect_first",
    ];
    it.each(removed)("%s は ALL_BADGES に含まれない", id => {
      expect(ALL_BADGES.find(b => b.id === id)).toBeUndefined();
    });
  });

  // ─── 累計クエスト系（10〜1000、承認系は統合済み） ──────
  describe("quest count badges", () => {
    it("quest_10: approvedCount >= 10", () => {
      expect(checkBadgeConditions(ctx({ approvedCount: 10 })).has("quest_10")).toBe(true);
      expect(checkBadgeConditions(ctx({ approvedCount: 9 })).has("quest_10")).toBe(false);
    });
    it("quest_25: approvedCount >= 25", () => {
      expect(checkBadgeConditions(ctx({ approvedCount: 25 })).has("quest_25")).toBe(true);
      expect(checkBadgeConditions(ctx({ approvedCount: 24 })).has("quest_25")).toBe(false);
    });
    it("quest_500: approvedCount >= 500", () => {
      expect(checkBadgeConditions(ctx({ approvedCount: 500 })).has("quest_500")).toBe(true);
      expect(checkBadgeConditions(ctx({ approvedCount: 499 })).has("quest_500")).toBe(false);
    });
    it("quest_1000: approvedCount >= 1000", () => {
      expect(checkBadgeConditions(ctx({ approvedCount: 1000 })).has("quest_1000")).toBe(true);
      expect(checkBadgeConditions(ctx({ approvedCount: 999 })).has("quest_1000")).toBe(false);
    });
    it("旧 approval_* 系は廃止（quest_* に統合）", () => {
      ["approval_10", "approval_30", "approval_50", "approval_100", "approval_200"].forEach(id => {
        expect(ALL_BADGES.find(b => b.id === id)).toBeUndefined();
      });
    });
  });

  // ─── タスクストリーク系 ────────────────────────────────
  describe("task streak badges", () => {
    it("streak_5: bestTaskStreak >= 5", () => {
      expect(checkBadgeConditions(ctx({ bestTaskStreak: 5 })).has("streak_5")).toBe(true);
      expect(checkBadgeConditions(ctx({ bestTaskStreak: 4 })).has("streak_5")).toBe(false);
    });
    it("streak_100: bestTaskStreak >= 100", () => {
      expect(checkBadgeConditions(ctx({ bestTaskStreak: 100 })).has("streak_100")).toBe(true);
      expect(checkBadgeConditions(ctx({ bestTaskStreak: 99 })).has("streak_100")).toBe(false);
    });
    it("streak_3 は廃止", () => {
      expect(ALL_BADGES.find(b => b.id === "streak_3")).toBeUndefined();
    });
    it("streak_comeback は残置（hasComeback7）", () => {
      expect(checkBadgeConditions(ctx({ hasComeback7: true })).has("streak_comeback")).toBe(true);
    });
  });

  // ─── ログインストリーク系 ────────────────────────────
  describe("login streak badges", () => {
    it("login_7: loginBestStreak >= 7", () => {
      expect(checkBadgeConditions(ctx({ loginBestStreak: 7 })).has("login_7")).toBe(true);
      expect(checkBadgeConditions(ctx({ loginBestStreak: 6 })).has("login_7")).toBe(false);
    });
    it("login_100: loginBestStreak >= 100", () => {
      expect(checkBadgeConditions(ctx({ loginBestStreak: 100 })).has("login_100")).toBe(true);
      expect(checkBadgeConditions(ctx({ loginBestStreak: 99 })).has("login_100")).toBe(false);
    });
    it("login_3 は廃止", () => {
      expect(ALL_BADGES.find(b => b.id === "login_3")).toBeUndefined();
    });
  });

  // ─── XP系 ────────────────────────────────────────────
  describe("xp badges", () => {
    it("xp_50: totalXp >= 50", () => {
      expect(checkBadgeConditions(ctx({ totalXp: 50 })).has("xp_50")).toBe(true);
      expect(checkBadgeConditions(ctx({ totalXp: 49 })).has("xp_50")).toBe(false);
    });
    it("xp_1000: totalXp >= 1000", () => {
      expect(checkBadgeConditions(ctx({ totalXp: 1000 })).has("xp_1000")).toBe(true);
      expect(checkBadgeConditions(ctx({ totalXp: 999 })).has("xp_1000")).toBe(false);
    });
    it("xp_10/xp_30 は廃止（序盤バッジ削減）", () => {
      expect(ALL_BADGES.find(b => b.id === "xp_10")).toBeUndefined();
      expect(ALL_BADGES.find(b => b.id === "xp_30")).toBeUndefined();
    });
  });

  // ─── 写真系 ──────────────────────────────────────────
  describe("photo badges", () => {
    it("photo_15: photoCount >= 15", () => {
      expect(checkBadgeConditions(ctx({ photoCount: 15 })).has("photo_15")).toBe(true);
      expect(checkBadgeConditions(ctx({ photoCount: 14 })).has("photo_15")).toBe(false);
    });
    it("photo_200: photoCount >= 200", () => {
      expect(checkBadgeConditions(ctx({ photoCount: 200 })).has("photo_200")).toBe(true);
      expect(checkBadgeConditions(ctx({ photoCount: 199 })).has("photo_200")).toBe(false);
    });
    it("photo_5 は廃止（序盤バッジ削減）", () => {
      expect(ALL_BADGES.find(b => b.id === "photo_5")).toBeUndefined();
    });
  });

  // ─── 期限ボーナス系 ──────────────────────────────────
  describe("deadline badges", () => {
    it("deadline_10: deadlineBonusCount >= 10", () => {
      expect(checkBadgeConditions(ctx({ deadlineBonusCount: 10 })).has("deadline_10")).toBe(true);
      expect(checkBadgeConditions(ctx({ deadlineBonusCount: 9 })).has("deadline_10")).toBe(false);
    });
    it("deadline_200: deadlineBonusCount >= 200", () => {
      expect(checkBadgeConditions(ctx({ deadlineBonusCount: 200 })).has("deadline_200")).toBe(true);
      expect(checkBadgeConditions(ctx({ deadlineBonusCount: 199 })).has("deadline_200")).toBe(false);
    });
  });

  // ─── 時間帯系 ────────────────────────────────────────
  describe("time-of-day badges", () => {
    it("morning_10: morningReportCount >= 10", () => {
      expect(checkBadgeConditions(ctx({ morningReportCount: 10 })).has("morning_10")).toBe(true);
      expect(checkBadgeConditions(ctx({ morningReportCount: 9 })).has("morning_10")).toBe(false);
    });
    it("morning_30: morningReportCount >= 30", () => {
      expect(checkBadgeConditions(ctx({ morningReportCount: 30 })).has("morning_30")).toBe(true);
      expect(checkBadgeConditions(ctx({ morningReportCount: 29 })).has("morning_30")).toBe(false);
    });
    it("afternoon_15: afternoonReportCount >= 15", () => {
      expect(checkBadgeConditions(ctx({ afternoonReportCount: 15 })).has("afternoon_15")).toBe(true);
      expect(checkBadgeConditions(ctx({ afternoonReportCount: 14 })).has("afternoon_15")).toBe(false);
    });
    it("quick_10: quickReportCount >= 10", () => {
      expect(checkBadgeConditions(ctx({ quickReportCount: 10 })).has("quick_10")).toBe(true);
      expect(checkBadgeConditions(ctx({ quickReportCount: 9 })).has("quick_10")).toBe(false);
    });
    it("quick_30: quickReportCount >= 30", () => {
      expect(checkBadgeConditions(ctx({ quickReportCount: 30 })).has("quick_30")).toBe(true);
    });
  });

  // ─── 1日の達成系 ─────────────────────────────────────
  describe("daily achievement badges", () => {
    it("perfect_5: perfectDaysCount >= 5", () => {
      expect(checkBadgeConditions(ctx({ perfectDaysCount: 5 })).has("perfect_5")).toBe(true);
      expect(checkBadgeConditions(ctx({ perfectDaysCount: 4 })).has("perfect_5")).toBe(false);
    });
    it("perfect_50: perfectDaysCount >= 50", () => {
      expect(checkBadgeConditions(ctx({ perfectDaysCount: 50 })).has("perfect_50")).toBe(true);
    });
    it("day_4quests: maxQuestsPerDay >= 4", () => {
      expect(checkBadgeConditions(ctx({ maxQuestsPerDay: 4 })).has("day_4quests")).toBe(true);
      expect(checkBadgeConditions(ctx({ maxQuestsPerDay: 3 })).has("day_4quests")).toBe(false);
    });
    it("day_6quests: maxQuestsPerDay >= 6", () => {
      expect(checkBadgeConditions(ctx({ maxQuestsPerDay: 6 })).has("day_6quests")).toBe(true);
      expect(checkBadgeConditions(ctx({ maxQuestsPerDay: 5 })).has("day_6quests")).toBe(false);
    });
    it("day_3quests / day_5quests は廃止（1日3個は容易すぎ）", () => {
      expect(ALL_BADGES.find(b => b.id === "day_3quests")).toBeUndefined();
      expect(ALL_BADGES.find(b => b.id === "day_5quests")).toBeUndefined();
    });
  });

  // ─── 週・月の達成系 ──────────────────────────────────
  describe("weekly/monthly badges", () => {
    it("week_5x10: weeksWithFivePlusDays >= 10", () => {
      expect(checkBadgeConditions(ctx({ weeksWithFivePlusDays: 10 })).has("week_5x10")).toBe(true);
      expect(checkBadgeConditions(ctx({ weeksWithFivePlusDays: 9 })).has("week_5x10")).toBe(false);
    });
    it("week_7x5: weeksWithSevenDays >= 5", () => {
      expect(checkBadgeConditions(ctx({ weeksWithSevenDays: 5 })).has("week_7x5")).toBe(true);
    });
    it("month_perfect_x3: perfectMonthsCount >= 3", () => {
      expect(checkBadgeConditions(ctx({ perfectMonthsCount: 3 })).has("month_perfect_x3")).toBe(true);
      expect(checkBadgeConditions(ctx({ perfectMonthsCount: 2 })).has("month_perfect_x3")).toBe(false);
    });
    it("month_15x6: monthsWithFifteenPlusDays >= 6", () => {
      expect(checkBadgeConditions(ctx({ monthsWithFifteenPlusDays: 6 })).has("month_15x6")).toBe(true);
    });
    it("month_10 は廃止（中盤バッジ絞り込み）", () => {
      expect(ALL_BADGES.find(b => b.id === "month_10")).toBeUndefined();
    });
  });

  // ─── 転生系 ──────────────────────────────────────────
  describe("rebirth badges", () => {
    it("rebirth_10: rebirthCount >= 10", () => {
      expect(checkBadgeConditions(ctx({ rebirthCount: 10 })).has("rebirth_10")).toBe(true);
      expect(checkBadgeConditions(ctx({ rebirthCount: 9 })).has("rebirth_10")).toBe(false);
    });
    it("rebirth_7 は廃止（rebirth_10 に統合）", () => {
      expect(ALL_BADGES.find(b => b.id === "rebirth_7")).toBeUndefined();
    });
  });

  // ─── コレクション系 ──────────────────────────────────
  describe("collection badges", () => {
    it("collection_all: hasAllTypesCollection で解除", () => {
      expect(checkBadgeConditions(ctx({ hasAllTypesCollection: true })).has("collection_all")).toBe(true);
    });
    it("collection_6: collectionCount >= 6", () => {
      expect(checkBadgeConditions(ctx({ collectionCount: 6 })).has("collection_6")).toBe(true);
    });
  });

  // ─── 自発性・粘り強さ系 ──────────────────────────────
  describe("self-task / habit / mental badges", () => {
    it("self_task_5: selfTaskApprovedCount >= 5", () => {
      expect(checkBadgeConditions(ctx({ selfTaskApprovedCount: 5 })).has("self_task_5")).toBe(true);
      expect(checkBadgeConditions(ctx({ selfTaskApprovedCount: 4 })).has("self_task_5")).toBe(false);
    });
    it("self_task_30: selfTaskApprovedCount >= 30", () => {
      expect(checkBadgeConditions(ctx({ selfTaskApprovedCount: 30 })).has("self_task_30")).toBe(true);
    });
    it("habit_60: maxSingleTaskBestStreak >= 60", () => {
      expect(checkBadgeConditions(ctx({ maxSingleTaskBestStreak: 60 })).has("habit_60")).toBe(true);
    });
    it("skip_aware: skipCount >= 10（旧5から引き上げ）", () => {
      expect(checkBadgeConditions(ctx({ skipCount: 10 })).has("skip_aware")).toBe(true);
      expect(checkBadgeConditions(ctx({ skipCount: 9 })).has("skip_aware")).toBe(false);
    });
    it("self_task_3 / skip_recovery は廃止", () => {
      expect(ALL_BADGES.find(b => b.id === "self_task_3")).toBeUndefined();
      expect(ALL_BADGES.find(b => b.id === "skip_recovery")).toBeUndefined();
    });
  });

  // ─── 曜日・季節系 ────────────────────────────────────
  describe("day-of-week / season badges", () => {
    it("monday_10: mondayCount >= 10（旧5から引き上げ）", () => {
      expect(checkBadgeConditions(ctx({ mondayCount: 10 })).has("monday_10")).toBe(true);
      expect(checkBadgeConditions(ctx({ mondayCount: 9 })).has("monday_10")).toBe(false);
    });
    it("weekend_20: weekendCount >= 20", () => {
      expect(checkBadgeConditions(ctx({ weekendCount: 20 })).has("weekend_20")).toBe(true);
    });
    it("spring: springDays >= 15", () => {
      expect(checkBadgeConditions(ctx({ springDays: 15 })).has("spring")).toBe(true);
      expect(checkBadgeConditions(ctx({ springDays: 14 })).has("spring")).toBe(false);
    });
    it("summer: summerDays >= 20", () => {
      expect(checkBadgeConditions(ctx({ summerDays: 20 })).has("summer")).toBe(true);
      expect(checkBadgeConditions(ctx({ summerDays: 19 })).has("summer")).toBe(false);
    });
    it("month_end_10: monthEndCount >= 10（旧5から引き上げ）", () => {
      expect(checkBadgeConditions(ctx({ monthEndCount: 10 })).has("month_end_10")).toBe(true);
      expect(checkBadgeConditions(ctx({ monthEndCount: 9 })).has("month_end_10")).toBe(false);
    });
    it("monday_5 / weekend_10 / month_end は廃止（旧ID）", () => {
      expect(ALL_BADGES.find(b => b.id === "monday_5")).toBeUndefined();
      expect(ALL_BADGES.find(b => b.id === "weekend_10")).toBeUndefined();
      expect(ALL_BADGES.find(b => b.id === "month_end")).toBeUndefined();
    });
  });

  // ─── マイルストーン・複合系 ──────────────────────────
  describe("milestone & composite badges", () => {
    it("milestone_25: unlockedBadgeCount >= 25", () => {
      expect(checkBadgeConditions(ctx({ unlockedBadgeCount: 25 })).has("milestone_25")).toBe(true);
    });
    it("milestone_90: unlockedBadgeCount >= 90", () => {
      expect(checkBadgeConditions(ctx({ unlockedBadgeCount: 90 })).has("milestone_90")).toBe(true);
      expect(checkBadgeConditions(ctx({ unlockedBadgeCount: 89 })).has("milestone_90")).toBe(false);
    });
    it("milestone_10 は廃止（序盤バッジ削減）", () => {
      expect(ALL_BADGES.find(b => b.id === "milestone_10")).toBeUndefined();
    });
    it("triple_crown: tripleCrownDaysCount >= 25（旧10から引き上げ）", () => {
      expect(checkBadgeConditions(ctx({ tripleCrownDaysCount: 25 })).has("triple_crown")).toBe(true);
      expect(checkBadgeConditions(ctx({ tripleCrownDaysCount: 24 })).has("triple_crown")).toBe(false);
    });
    it("retry_10: retrySuccessCount >= 10（旧5から引き上げ）", () => {
      expect(checkBadgeConditions(ctx({ retrySuccessCount: 10 })).has("retry_10")).toBe(true);
      expect(checkBadgeConditions(ctx({ retrySuccessCount: 9 })).has("retry_10")).toBe(false);
    });
    it("retry_5 は廃止（retry_10 に統合）", () => {
      expect(ALL_BADGES.find(b => b.id === "retry_5")).toBeUndefined();
    });
    it("multi_tasker / speed_star / comeback_14 / comeback_7x2 は残置", () => {
      expect(checkBadgeConditions(ctx({ hasMagicDay: true })).has("multi_tasker")).toBe(true);
      expect(checkBadgeConditions(ctx({ hasWeekWithDailyDeadline: true })).has("speed_star")).toBe(true);
      expect(checkBadgeConditions(ctx({ hasComeback14: true })).has("comeback_14")).toBe(true);
      expect(checkBadgeConditions(ctx({ hasComeback7After2Breaks: true })).has("comeback_7x2")).toBe(true);
    });
  });

  // ─── 序盤の体感: 最初の1クエスト承認で何個解放されるか ──
  describe("早期解放の挙動: 序盤は最大2個まで（中盤からはもっと絞る）", () => {
    it("初回承認だけでは first_quest のみ（合計1個）", () => {
      const earned = checkBadgeConditions(ctx({
        approvedCount: 1,
        totalXp: 1,
      }));
      expect(earned.size).toBe(1);
      expect(earned.has("first_quest")).toBe(true);
    });

    it("写真付き・期限ボーナス付きの3pt初回タスクでも、first_quest のみ", () => {
      const earned = checkBadgeConditions(ctx({
        approvedCount: 1,
        totalXp: 3,
        photoCount: 1,
        deadlineBonusCount: 1,
        morningReportCount: 1,
        quickReportCount: 1,
      }));
      // 旧設計では7個以上同時解放されていたが、新設計では1個のみ
      expect(earned.size).toBe(1);
      expect(earned.has("first_quest")).toBe(true);
    });

    it("ステージ1進化（first_hatch）と初承認が同時でも、合計2個まで", () => {
      const earned = checkBadgeConditions(ctx({
        approvedCount: 1,
        evolutionStage: 1,
      }));
      expect(earned.size).toBe(2);
      expect(earned.has("first_quest")).toBe(true);
      expect(earned.has("first_hatch")).toBe(true);
    });

    it("4日連続承認では、まだ streak_5 も login_7 も未解放（中盤の閾値）", () => {
      const earned = checkBadgeConditions(ctx({
        approvedCount: 4,
        bestTaskStreak: 4,
        loginBestStreak: 4,
        totalXp: 4,
      }));
      expect(earned.has("streak_5")).toBe(false);
      expect(earned.has("login_7")).toBe(false);
      expect(earned.has("quest_10")).toBe(false);
      // ようこそ系 first_quest だけ
      expect(earned.size).toBe(1);
    });
  });

  // ─── 宝箱系（新規追加） ──────────────────────────────
  describe("treasure badges", () => {
    it("treasure_first: treasureOpenedCount >= 1", () => {
      expect(checkBadgeConditions(ctx({ treasureOpenedCount: 1 })).has("treasure_first")).toBe(true);
      expect(checkBadgeConditions(ctx({})).has("treasure_first")).toBe(false);
    });
    it("treasure_25: treasureOpenedCount >= 25", () => {
      expect(checkBadgeConditions(ctx({ treasureOpenedCount: 25 })).has("treasure_25")).toBe(true);
      expect(checkBadgeConditions(ctx({ treasureOpenedCount: 24 })).has("treasure_25")).toBe(false);
    });
    it("treasure_rare: rareTreasureCount >= 1（RARE当選）", () => {
      expect(checkBadgeConditions(ctx({ rareTreasureCount: 1 })).has("treasure_rare")).toBe(true);
      expect(checkBadgeConditions(ctx({})).has("treasure_rare")).toBe(false);
    });
  });

  // ─── コレクションアイテム系（新規追加） ──────────────
  describe("collection item badges", () => {
    it("item_first: collectionItemCount >= 1", () => {
      expect(checkBadgeConditions(ctx({ collectionItemCount: 1 })).has("item_first")).toBe(true);
      expect(checkBadgeConditions(ctx({})).has("item_first")).toBe(false);
    });
    it("item_30: collectionItemCount >= 30（種類）", () => {
      expect(checkBadgeConditions(ctx({ collectionItemCount: 30 })).has("item_30")).toBe(true);
      expect(checkBadgeConditions(ctx({ collectionItemCount: 29 })).has("item_30")).toBe(false);
    });
    it("season_complete: collectionSeasonsComplete >= 1（1シーズン20種制覇）", () => {
      expect(checkBadgeConditions(ctx({ collectionSeasonsComplete: 1 })).has("season_complete")).toBe(true);
      expect(checkBadgeConditions(ctx({ collectionSeasonsComplete: 0 })).has("season_complete")).toBe(false);
    });
    it("item_80_all: hasAllCollectionItems で解除", () => {
      expect(checkBadgeConditions(ctx({ hasAllCollectionItems: true })).has("item_80_all")).toBe(true);
      expect(checkBadgeConditions(ctx({ collectionItemCount: 79 })).has("item_80_all")).toBe(false);
    });
  });

  // ─── 転生卵系（新規追加） ────────────────────────────
  describe("rebirth egg badges", () => {
    it("rebirth_egg_used: rebirthEggUsed=true で解除", () => {
      expect(checkBadgeConditions(ctx({ rebirthEggUsed: true })).has("rebirth_egg_used")).toBe(true);
      expect(checkBadgeConditions(ctx({})).has("rebirth_egg_used")).toBe(false);
    });
  });

  // ─── 入れ替えで廃止されたバッジ ──────────────────────
  describe("入れ替えで廃止された旧バッジ", () => {
    const removed = [
      "quest_750", "streak_50", "login_60", "login_200",
      "photo_60", "deadline_25", "morning_60", "afternoon_50",
    ];
    it.each(removed)("%s は ALL_BADGES に含まれない", id => {
      expect(ALL_BADGES.find(b => b.id === id)).toBeUndefined();
    });
  });

  // ─── 全バッジ数チェック ──────────────────────────────
  it("ALL_BADGES は100個である", () => {
    expect(ALL_BADGES).toHaveLength(100);
  });

  it("全バッジIDがユニーク", () => {
    const ids = ALL_BADGES.map(b => b.id);
    expect(new Set(ids).size).toBe(100);
  });

  it("全バッジが id, name, emoji, description を持つ", () => {
    for (const badge of ALL_BADGES) {
      expect(badge.id).toBeTruthy();
      expect(badge.name).toBeTruthy();
      expect(badge.emoji).toBeTruthy();
      expect(badge.description).toBeTruthy();
    }
  });
});
