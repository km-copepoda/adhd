// Issue #161: QuestInstance 由来のバッジ集計を行う純粋関数 buildQuestBadgeStats の仕様。
//
// 入力は DB 集計後の値だけ（Prisma 型は受けない）:
//   buildQuestBadgeStats(perDateRows, scalars, todayStr)
//   perDateRows: { date:"YYYY-MM-DD", total, approved, skipped, approvedDeadline, approvedPhoto }[]
//   scalars: { retrySuccessCount, photoBonusXpCount, quickReportCount, morningReportCount, afternoonReportCount }
// 戻り値: BadgeContext の QuestInstance 由来の全項目（QUEST_KEYS。totalXp を含む）。
// 時間帯・速報の判定そのものは loadBadgeContext 側（badgesLoadContextQuestStats.test.ts）で検証する。

import { describe, it, expect } from "vitest";
import { buildQuestBadgeStats } from "@/lib/badgeQuestStats";
import { checkBadgeConditions } from "@/lib/badges.data";
import type { BadgeContext } from "@/lib/badges.data";
import {
  QUEST_KEYS,
  aggregateQuestRows,
  dateRange,
  nonQuestBaseCtx,
  pickQuestStats,
  quest,
  randomQuestRows,
  referenceQuestStats,
  type QuestRow,
} from "../helpers/badgeContextReference";

const TODAY = "2026-06-15";

function statsOf(rows: QuestRow[], todayStr = TODAY) {
  const { perDateRows, scalars } = aggregateQuestRows(rows);
  return buildQuestBadgeStats(perDateRows, scalars, todayStr);
}

function expectSameAsReference(rows: QuestRow[], todayStr = TODAY) {
  const actual = pickQuestStats({ ...nonQuestBaseCtx(), ...statsOf(rows, todayStr) } as BadgeContext);
  const expected = referenceQuestStats(rows, todayStr);
  expect(actual).toEqual(expected);
  // 解除バッジ集合も一致
  const ctxA = { ...nonQuestBaseCtx(), ...actual } as BadgeContext;
  const ctxE = { ...nonQuestBaseCtx(), ...expected } as BadgeContext;
  expect([...checkBadgeConditions(ctxA)].sort()).toEqual([...checkBadgeConditions(ctxE)].sort());
}

describe("buildQuestBadgeStats: 件数の境界", () => {
  it("0件: 数値は 0、真偽は false（maxQuestsPerDay も 0）", () => {
    const s = buildQuestBadgeStats(
      [],
      { retrySuccessCount: 0, photoBonusXpCount: 0, quickReportCount: 0, morningReportCount: 0, afternoonReportCount: 0 },
      TODAY,
    );
    for (const k of QUEST_KEYS) {
      expect(s[k], k).toBe(typeof s[k] === "boolean" ? false : 0);
    }
    expect(s.maxQuestsPerDay).toBe(0);
    expect(s.hasComeback7).toBe(false);
  });

  it("1件（APPROVED・写真/期限なし）: approvedCount=1, totalXp=1, maxQuestsPerDay=1", () => {
    const s = statsOf([quest("2026-06-10")]);
    expect(s.approvedCount).toBe(1);
    expect(s.totalXp).toBe(1);
    expect(s.maxQuestsPerDay).toBe(1);
    expect(s.photoCount).toBe(0);
    expect(s.deadlineBonusCount).toBe(0);
    expect(s.perfectDaysCount).toBe(1);
  });

  it("大量（1,500件・数年分・全ステータス混在）でも参照実装と完全一致", () => {
    expectSameAsReference(randomQuestRows(1, 1500), "2026-06-15");
  });

  it.each([2, 3, 4, 5, 6, 7, 8, 9])("ランダム seed=%i（800件）で参照実装と完全一致", (seed) => {
    expectSameAsReference(randomQuestRows(seed, 800), "2025-09-30");
  });

  it("日付が密な長期データ（毎日・5年）でも一致", () => {
    const rows = dateRange("2021-01-01", 365 * 5).flatMap((d, i) => [
      quest(d, { deadlineBonusEarned: i % 2 === 0, photoUrl: i % 3 === 0 ? "u" : null }),
      ...(i % 7 === 0 ? [quest(d, { status: "SKIPPED" })] : []),
    ]);
    expectSameAsReference(rows, "2026-01-01");
  });
});

describe("buildQuestBadgeStats: 承認以外の行", () => {
  it("承認以外しかない日は承認日集合に入らず、曜日・季節・最大件数に数えない", () => {
    // 2026-06-01 は月曜
    const rows = ["PENDING", "REPORTED", "REJECTED", "SKIP_REPORTED"].map((status) => quest("2026-06-01", { status }));
    const s = statsOf(rows);
    expect(s.approvedCount).toBe(0);
    expect(s.mondayCount).toBe(0);
    expect(s.maxQuestsPerDay).toBe(0);
    expect(s.monthsWithTenPlusDays).toBe(0);
    expect(s.weeksWithFivePlusDays).toBe(0);
    expect(s.skipThenNextDayCount).toBe(0);
    expect(s.perfectDaysCount).toBe(0);
  });

  it("承認以外の日付（approved=0）が混じっても季節・月末の日数に混ざらない", () => {
    const rows = [quest("2026-04-30", { status: "REPORTED" }), quest("2026-07-31", { status: "PENDING" })];
    const s = statsOf(rows);
    expect(s.springDays).toBe(0);
    expect(s.summerDays).toBe(0);
    expect(s.monthEndCount).toBe(0);
  });
});

describe("buildQuestBadgeStats: パーフェクトデイと todayStr 境界", () => {
  it("APPROVED+SKIPPED だけの過去日は数える", () => {
    expect(statsOf([quest("2026-06-10"), quest("2026-06-10", { status: "SKIPPED" })]).perfectDaysCount).toBe(1);
  });

  it("REJECTED が1件でも混じる過去日は数えない", () => {
    expect(statsOf([quest("2026-06-10"), quest("2026-06-10", { status: "REJECTED" })]).perfectDaysCount).toBe(0);
  });

  it("前日は含み、当日・未来は含まない（todayStr 境界）", () => {
    const rows = [quest("2026-06-14"), quest("2026-06-15"), quest("2026-06-16")];
    expect(statsOf(rows, "2026-06-15").perfectDaysCount).toBe(1);
    expect(statsOf(rows, "2026-06-14").perfectDaysCount).toBe(0);
    expect(statsOf(rows, "2026-06-17").perfectDaysCount).toBe(3);
  });

  it("SKIPPED のみの過去日も（全件 APPROVED/SKIPPED なので）数える", () => {
    expect(statsOf([quest("2026-06-10", { status: "SKIPPED" })]).perfectDaysCount).toBe(1);
  });
});

describe("buildQuestBadgeStats: 写真・期限ボーナス・XP・retry", () => {
  it("photoUrl: null / 空文字 / 値あり。値ありだけ photoCount と tripleCrown に数える", () => {
    for (const [photoUrl, expected] of [[null, 0], ["", 0], ["https://x/a.png", 1]] as const) {
      const s = statsOf([quest("2026-06-10", { photoUrl, deadlineBonusEarned: true })]);
      expect(s.photoCount, String(photoUrl)).toBe(expected);
      expect(s.tripleCrownDaysCount, String(photoUrl)).toBe(expected);
      expect(s.hasMagicDay, String(photoUrl)).toBe(expected === 1);
    }
  });

  it("photoBonus XP: false+写真 → +0、true+写真なし/空文字 → +0、true+写真あり → +1", () => {
    expect(statsOf([quest("2026-06-10", { photoUrl: "u", template: { photoBonus: false } })]).totalXp).toBe(1);
    expect(statsOf([quest("2026-06-10", { photoUrl: null, template: { photoBonus: true } })]).totalXp).toBe(1);
    expect(statsOf([quest("2026-06-10", { photoUrl: "", template: { photoBonus: true } })]).totalXp).toBe(1);
    expect(statsOf([quest("2026-06-10", { photoUrl: "u", template: { photoBonus: true } })]).totalXp).toBe(2);
  });

  it("totalXp = 承認数 + 期限ボーナス数 + 写真ボーナス数", () => {
    const rows = [
      quest("2026-06-10", { deadlineBonusEarned: true, photoUrl: "u", template: { photoBonus: true } }), // 3
      quest("2026-06-11", { deadlineBonusEarned: true }), // 2
      quest("2026-06-12"), // 1
    ];
    expect(statsOf(rows).totalXp).toBe(6);
  });

  it("期限ボーナスは APPROVED のときだけ数える（REPORTED/SKIPPED の true は無視）", () => {
    const rows = [
      quest("2026-06-10", { deadlineBonusEarned: true }),
      quest("2026-06-10", { status: "REPORTED", deadlineBonusEarned: true }),
      quest("2026-06-10", { status: "SKIPPED", deadlineBonusEarned: true }),
    ];
    const s = statsOf(rows);
    expect(s.deadlineBonusCount).toBe(1);
    expect(s.totalXp).toBe(2);
  });

  it("retry: APPROVED かつ rejectionReason が non-empty のみ（null/空文字/REJECTED行は数えない）", () => {
    const rows = [
      quest("2026-06-10", { rejectionReason: "やり直し" }),
      quest("2026-06-10", { rejectionReason: null }),
      quest("2026-06-10", { rejectionReason: "" }),
      quest("2026-06-10", { status: "REJECTED", rejectionReason: "NG" }),
    ];
    expect(statsOf(rows).retrySuccessCount).toBe(1);
  });
});

describe("buildQuestBadgeStats: カレンダー境界", () => {
  it("ISO 週が年をまたぐ 2025-12-29〜2026-01-04 は1週・7日", () => {
    const rows = dateRange("2025-12-29", 7).map((d) => quest(d));
    const s = statsOf(rows, "2026-02-01");
    expect(s.weeksWithSevenDays).toBe(1);
    expect(s.weeksWithFivePlusDays).toBe(1);
    expect(s.mondayCount).toBe(1);
    expect(s.weekendCount).toBe(2);
    expect(s.hasNewYearQuest).toBe(true);
    expect(s.winterDays).toBe(7);
    expect(s.monthEndCount).toBe(3); // 12/29,30,31
    expectSameAsReference(rows, "2026-02-01");
  });

  it("年またぎで週が分断されない: 12/28(日) は前の週", () => {
    const rows = dateRange("2025-12-28", 7).map((d) => quest(d)); // 日〜土
    expect(statsOf(rows, "2026-02-01").weeksWithSevenDays).toBe(0);
  });

  it("うるう年2月: 29日すべて承認で perfectMonths=1、28日だけなら 0", () => {
    const full = dateRange("2028-02-01", 29).map((d) => quest(d));
    expect(statsOf(full, "2028-06-01").perfectMonthsCount).toBe(1);
    expect(statsOf(full, "2028-06-01").monthsWithTwentyPlusDays).toBe(1);
    expect(statsOf(full, "2028-06-01").monthEndCount).toBe(3); // 27,28,29
    expect(statsOf(full.slice(0, 28), "2028-06-01").perfectMonthsCount).toBe(0);
  });

  it("平年2月: 28日すべてで perfectMonths=1、月末は 26,27,28", () => {
    const full = dateRange("2027-02-01", 28).map((d) => quest(d));
    const s = statsOf(full, "2027-06-01");
    expect(s.perfectMonthsCount).toBe(1);
    expect(s.monthEndCount).toBe(3);
  });

  it("月末3日間: 30日月(4月)は28-30、31日月(7月)は29-31、27日/28日は対象外", () => {
    expect(statsOf(["2026-04-28", "2026-04-29", "2026-04-30"].map((d) => quest(d)), "2026-12-01").monthEndCount).toBe(3);
    expect(statsOf([quest("2026-04-27")], "2026-12-01").monthEndCount).toBe(0);
    expect(statsOf(["2026-07-29", "2026-07-30", "2026-07-31"].map((d) => quest(d)), "2026-12-01").monthEndCount).toBe(3);
    expect(statsOf([quest("2026-07-28")], "2026-12-01").monthEndCount).toBe(0);
  });

  it("季節: 4月=春 / 7-8月=夏 / 9-10月=秋 / 12-1月=冬、3月・5月・6月・11月・2月はどれにも入らない", () => {
    const s = statsOf(
      ["2026-04-10", "2026-07-10", "2026-08-10", "2026-09-10", "2026-10-10", "2026-12-10", "2026-01-10",
        "2026-03-10", "2026-05-10", "2026-06-10", "2026-11-10", "2026-02-10"].map((d) => quest(d)),
      "2027-01-01",
    );
    expect([s.springDays, s.summerDays, s.autumnDays, s.winterDays]).toEqual([1, 2, 2, 2]);
  });

  it("hasNewYearQuest: 1/3 は true、1/4 と 12/31 は false", () => {
    expect(statsOf([quest("2026-01-03")]).hasNewYearQuest).toBe(true);
    expect(statsOf([quest("2026-01-04")]).hasNewYearQuest).toBe(false);
    expect(statsOf([quest("2025-12-31")]).hasNewYearQuest).toBe(false);
  });
});

describe("buildQuestBadgeStats: 日数系と件数系の区別", () => {
  it("同じ日に APPROVED が複数でも mondayCount は1、maxQuestsPerDay は件数", () => {
    // 2026-06-01 は月曜
    const s = statsOf([quest("2026-06-01"), quest("2026-06-01"), quest("2026-06-01")]);
    expect(s.mondayCount).toBe(1);
    expect(s.maxQuestsPerDay).toBe(3);
    expect(s.approvedCount).toBe(3);
  });

  it("maxQuestsPerDay は APPROVED のみの最大（他ステータスは含めない）", () => {
    const rows = [
      quest("2026-06-01"),
      quest("2026-06-02"), quest("2026-06-02"),
      quest("2026-06-03", { status: "REPORTED" }), quest("2026-06-03", { status: "REPORTED" }), quest("2026-06-03", { status: "REPORTED" }),
    ];
    expect(statsOf(rows).maxQuestsPerDay).toBe(2);
  });
});

describe("buildQuestBadgeStats: スキップ翌日", () => {
  it("スキップの翌日に APPROVED → 1", () => {
    expect(statsOf([quest("2026-06-10", { status: "SKIPPED" }), quest("2026-06-11")]).skipThenNextDayCount).toBe(1);
  });
  it("同じ日にスキップと承認 → 0", () => {
    expect(statsOf([quest("2026-06-10", { status: "SKIPPED" }), quest("2026-06-10")]).skipThenNextDayCount).toBe(0);
  });
  it("翌日が APPROVED でない（REPORTED）→ 0", () => {
    expect(statsOf([quest("2026-06-10", { status: "SKIPPED" }), quest("2026-06-11", { status: "REPORTED" })]).skipThenNextDayCount).toBe(0);
  });
  it("月末→翌月1日・年末→元日の日付またぎ", () => {
    const rows = [
      quest("2026-01-31", { status: "SKIPPED" }), quest("2026-02-01"),
      quest("2025-12-31", { status: "SKIPPED" }), quest("2026-01-01"),
    ];
    expect(statsOf(rows, "2026-12-01").skipThenNextDayCount).toBe(2);
  });
  it("skipCount は SKIPPED の件数（SKIP_REPORTED は含めない）", () => {
    const rows = [quest("2026-06-10", { status: "SKIPPED" }), quest("2026-06-10", { status: "SKIPPED" }), quest("2026-06-11", { status: "SKIP_REPORTED" })];
    expect(statsOf(rows).skipCount).toBe(2);
  });
});

describe("buildQuestBadgeStats: 複合チャレンジ・スピードスター・カムバック", () => {
  it("同じ日に期限ボーナス行と写真行が別々にあっても magic/tripleCrown が成立", () => {
    const rows = [quest("2026-06-10", { deadlineBonusEarned: true }), quest("2026-06-10", { photoUrl: "u" })];
    const s = statsOf(rows);
    expect(s.hasMagicDay).toBe(true);
    expect(s.tripleCrownDaysCount).toBe(1);
  });
  it("期限ボーナスの日と写真の日が別なら不成立", () => {
    const rows = [quest("2026-06-10", { deadlineBonusEarned: true }), quest("2026-06-11", { photoUrl: "u" })];
    const s = statsOf(rows);
    expect(s.hasMagicDay).toBe(false);
    expect(s.tripleCrownDaysCount).toBe(0);
  });
  it("スピードスター: 同じ ISO 週の月〜日すべて期限ボーナス → true、1日欠けたら false", () => {
    const week = dateRange("2026-06-01", 7).map((d) => quest(d, { deadlineBonusEarned: true }));
    expect(statsOf(week).hasWeekWithDailyDeadline).toBe(true);
    expect(statsOf(week.slice(0, 6)).hasWeekWithDailyDeadline).toBe(false);
  });
  it("スピードスター: 火〜翌月の7日連続は週をまたぐので false", () => {
    const rows = dateRange("2026-06-02", 7).map((d) => quest(d, { deadlineBonusEarned: true }));
    expect(statsOf(rows).hasWeekWithDailyDeadline).toBe(false);
  });
  it("スピードスター: 期限ボーナスが REPORTED の日は数えない", () => {
    const week = dateRange("2026-06-01", 7).map((d, i) => quest(d, { deadlineBonusEarned: true, status: i === 3 ? "REPORTED" : "APPROVED" }));
    expect(statsOf(week).hasWeekWithDailyDeadline).toBe(false);
  });
  it("カムバック: 3日→空白→7日 は comeback7 のみ true", () => {
    const rows = [...dateRange("2026-03-01", 3), ...dateRange("2026-03-10", 7)].map((d) => quest(d));
    const s = statsOf(rows);
    expect(s.hasComeback7).toBe(true);
    expect(s.hasComeback14).toBe(false);
    expect(s.hasComeback7After2Breaks).toBe(false);
  });
  it("カムバック: 2回中断後に7日連続で comeback7After2Breaks", () => {
    const rows = [...dateRange("2026-01-01", 2), ...dateRange("2026-01-10", 2), ...dateRange("2026-02-01", 7)].map((d) => quest(d));
    expect(statsOf(rows, "2026-12-01").hasComeback7After2Breaks).toBe(true);
  });
  it("カムバック: 中断なしの連続（14日）は comeback にならない", () => {
    const rows = dateRange("2026-03-01", 14).map((d) => quest(d));
    const s = statsOf(rows);
    expect(s.hasComeback7).toBe(false);
    expect(s.hasComeback14).toBe(false);
  });
});

describe("buildQuestBadgeStats: scalars の取り込み", () => {
  it("scalars の値をそのまま ctx 項目へ反映し、totalXp に photoBonusXpCount を加算する", () => {
    const s = buildQuestBadgeStats(
      [{ date: "2026-06-10", total: 6, approved: 4, skipped: 1, approvedDeadline: 2, approvedPhoto: 3 }],
      { retrySuccessCount: 2, photoBonusXpCount: 3, quickReportCount: 4, morningReportCount: 1, afternoonReportCount: 2 },
      TODAY,
    );
    expect(s.approvedCount).toBe(4);
    expect(s.skipCount).toBe(1);
    expect(s.deadlineBonusCount).toBe(2);
    expect(s.photoCount).toBe(3);
    expect(s.totalXp).toBe(4 + 2 + 3);
    expect(s.retrySuccessCount).toBe(2);
    expect(s.quickReportCount).toBe(4);
    expect(s.morningReportCount).toBe(1);
    expect(s.afternoonReportCount).toBe(2);
    expect(s.perfectDaysCount).toBe(0); // 4+1 !== 6
  });
});
