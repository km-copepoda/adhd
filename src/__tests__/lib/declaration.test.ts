import { describe, it, expect } from "vitest";
import {
  IDLE_EXPOSURE_THRESHOLD,
  DECLARATION_BONUS_XP,
  getMissedExposureCount,
  getIdleCalendarDays,
  isEligibleForDeclaration,
} from "@/lib/declaration";

const day = (s: string) => new Date(s + "T00:00:00.000Z");

describe("getMissedExposureCount — 通常タスク（carryOver=false）", () => {
  it("今日 PENDING + 過去 2 件すべて非APPROVED で 3 を返す（3日連続=即時発火境界）", () => {
    const allInstances = [
      { date: day("2026-05-09"), status: "PENDING" as const },
      { date: day("2026-05-08"), status: "PENDING" as const },
      { date: day("2026-05-07"), status: "PENDING" as const },
      { date: day("2026-05-06"), status: "APPROVED" as const },
    ];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-09"), carryOver: false }),
    ).toBe(3);
  });

  it("週次タスク: 今日(月) + 先週(月)スキップだけだと 2（まだ閾値未満）", () => {
    const allInstances = [
      { date: day("2026-05-11"), status: "PENDING" as const }, // 今週月曜
      { date: day("2026-05-04"), status: "SKIPPED" as const }, // 先週月曜
      { date: day("2026-04-27"), status: "APPROVED" as const },
    ];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-11"), carryOver: false }),
    ).toBe(2);
  });

  it("週次タスク: 3週連続非APPROVED で 3（閾値到達）", () => {
    const allInstances = [
      { date: day("2026-05-11"), status: "PENDING" as const },
      { date: day("2026-05-04"), status: "SKIPPED" as const },
      { date: day("2026-04-27"), status: "SKIPPED" as const },
      { date: day("2026-04-20"), status: "APPROVED" as const },
    ];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-11"), carryOver: false }),
    ).toBe(3);
  });

  it("APPROVED の連鎖直前で打ち切る（古い未消化 PENDING がさらに前にあっても無視）", () => {
    const allInstances = [
      { date: day("2026-05-09"), status: "PENDING" as const },
      { date: day("2026-05-08"), status: "APPROVED" as const },
      { date: day("2026-05-07"), status: "PENDING" as const }, // ここは数えない
      { date: day("2026-05-06"), status: "PENDING" as const },
    ];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-09"), carryOver: false }),
    ).toBe(1);
  });

  it("SKIPPED は連鎖を切らない（spec: スキップも放置として扱う）", () => {
    const allInstances = [
      { date: day("2026-05-09"), status: "PENDING" as const },
      { date: day("2026-05-08"), status: "SKIPPED" as const },
      { date: day("2026-05-07"), status: "SKIP_REPORTED" as const },
      { date: day("2026-05-06"), status: "REJECTED" as const },
      { date: day("2026-05-05"), status: "APPROVED" as const },
    ];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-09"), carryOver: false }),
    ).toBe(4);
  });

  it("インスタンスが空なら 0", () => {
    expect(
      getMissedExposureCount({ allInstances: [], today: day("2026-05-09"), carryOver: false }),
    ).toBe(0);
  });

  it("すべて非APPROVED（一度も完了していない新タスク）", () => {
    const allInstances = [
      { date: day("2026-05-09"), status: "PENDING" as const },
      { date: day("2026-05-08"), status: "PENDING" as const },
      { date: day("2026-05-07"), status: "PENDING" as const },
    ];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-09"), carryOver: false }),
    ).toBe(3);
  });
});

describe("getMissedExposureCount — carryOver タスク", () => {
  it("instance.date から today までの暦日数（inclusive）を返す（5/7→5/9 で 3）", () => {
    const allInstances = [
      { date: day("2026-05-07"), status: "PENDING" as const }, // carryOver で残ってる
      { date: day("2026-05-06"), status: "APPROVED" as const },
    ];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-09"), carryOver: true }),
    ).toBe(3);
  });

  it("instance.date が today と同じなら 1", () => {
    const allInstances = [{ date: day("2026-05-09"), status: "PENDING" as const }];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-09"), carryOver: true }),
    ).toBe(1);
  });

  it("APPROVED が直近の場合は 0（連鎖がない）", () => {
    const allInstances = [
      { date: day("2026-05-09"), status: "APPROVED" as const },
    ];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-09"), carryOver: true }),
    ).toBe(0);
  });

  it("インスタンスが空なら 0", () => {
    expect(
      getMissedExposureCount({ allInstances: [], today: day("2026-05-09"), carryOver: true }),
    ).toBe(0);
  });
});

describe("getIdleCalendarDays（UI 表示用: 最終 APPROVED からの暦日差）", () => {
  it("最終APPROVEDの日付からの経過日数（JST）を返す", () => {
    expect(
      getIdleCalendarDays({
        today: day("2026-05-09"),
        lastApprovedAt: day("2026-05-06"),
        templateCreatedAt: day("2026-04-01"),
      }),
    ).toBe(3);
  });

  it("一度もAPPROVEDされていない場合は templateCreatedAt 起点", () => {
    expect(
      getIdleCalendarDays({
        today: day("2026-05-09"),
        lastApprovedAt: null,
        templateCreatedAt: day("2026-05-05"),
      }),
    ).toBe(4);
  });

  it("未来日付がきても負数にせず 0", () => {
    expect(
      getIdleCalendarDays({
        today: day("2026-05-09"),
        lastApprovedAt: day("2026-05-10"),
        templateCreatedAt: day("2026-04-01"),
      }),
    ).toBe(0);
  });
});

describe("isEligibleForDeclaration", () => {
  it("missedExposures >= 3 かつ アクション可能ステータス（PENDING/REJECTED）なら true", () => {
    expect(isEligibleForDeclaration({ missedExposures: 3, status: "PENDING" })).toBe(true);
    expect(isEligibleForDeclaration({ missedExposures: 5, status: "REJECTED" })).toBe(true);
  });

  it("missedExposures < 3 なら false（境界 2）", () => {
    expect(isEligibleForDeclaration({ missedExposures: 2, status: "PENDING" })).toBe(false);
    expect(isEligibleForDeclaration({ missedExposures: 0, status: "PENDING" })).toBe(false);
  });

  it("既に今日アクション済みのステータスでは false", () => {
    expect(isEligibleForDeclaration({ missedExposures: 5, status: "REPORTED" })).toBe(false);
    expect(isEligibleForDeclaration({ missedExposures: 5, status: "APPROVED" })).toBe(false);
    expect(isEligibleForDeclaration({ missedExposures: 5, status: "SKIPPED" })).toBe(false);
    expect(isEligibleForDeclaration({ missedExposures: 5, status: "SKIP_REPORTED" })).toBe(false);
  });
});

describe("constants", () => {
  it("IDLE_EXPOSURE_THRESHOLD は 3", () => {
    expect(IDLE_EXPOSURE_THRESHOLD).toBe(3);
  });

  it("DECLARATION_BONUS_XP は 1", () => {
    expect(DECLARATION_BONUS_XP).toBe(1);
  });
});
