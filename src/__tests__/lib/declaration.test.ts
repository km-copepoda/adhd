import { describe, it, expect } from "vitest";
import {
  IDLE_DAYS_THRESHOLD,
  DECLARATION_BONUS_XP,
  getIdleDays,
  isEligibleForDeclaration,
} from "@/lib/declaration";

const day = (s: string) => new Date(s + "T00:00:00.000Z");

describe("getIdleDays", () => {
  it("最終APPROVEDの日付からの経過日数（JST）を返す", () => {
    expect(
      getIdleDays({
        today: day("2026-05-09"),
        lastApprovedAt: day("2026-05-06"),
        templateCreatedAt: day("2026-04-01"),
      }),
    ).toBe(3);
  });

  it("当日にAPPROVED済みなら0を返す", () => {
    expect(
      getIdleDays({
        today: day("2026-05-09"),
        lastApprovedAt: day("2026-05-09"),
        templateCreatedAt: day("2026-04-01"),
      }),
    ).toBe(0);
  });

  it("一度もAPPROVEDされていない場合は templateCreatedAt からの経過日数を返す", () => {
    expect(
      getIdleDays({
        today: day("2026-05-09"),
        lastApprovedAt: null,
        templateCreatedAt: day("2026-05-05"),
      }),
    ).toBe(4);
  });

  it("未来の lastApprovedAt が来た場合でも負数にせず 0 を返す", () => {
    expect(
      getIdleDays({
        today: day("2026-05-09"),
        lastApprovedAt: day("2026-05-10"),
        templateCreatedAt: day("2026-04-01"),
      }),
    ).toBe(0);
  });

  it("時刻成分は切り捨てて日付ベースで計算する", () => {
    // approvedAt が「2026-05-06 23:30 JST」相当でも 5/6 として 3 日扱いになる
    expect(
      getIdleDays({
        today: day("2026-05-09"),
        // JST 23:30 == UTC 14:30 of the same JST date
        lastApprovedAt: new Date("2026-05-06T14:30:00.000Z"),
        templateCreatedAt: day("2026-04-01"),
      }),
    ).toBe(3);
  });
});

describe("isEligibleForDeclaration", () => {
  it("idleDays >= 3 かつ アクション可能ステータス（PENDING/REJECTED）なら true", () => {
    expect(isEligibleForDeclaration({ idleDays: 3, status: "PENDING" })).toBe(true);
    expect(isEligibleForDeclaration({ idleDays: 5, status: "REJECTED" })).toBe(true);
  });

  it("idleDays < 3 なら false（境界）", () => {
    expect(isEligibleForDeclaration({ idleDays: 2, status: "PENDING" })).toBe(false);
    expect(isEligibleForDeclaration({ idleDays: 0, status: "PENDING" })).toBe(false);
  });

  it("既に今日アクション済みのステータスでは false", () => {
    expect(isEligibleForDeclaration({ idleDays: 5, status: "REPORTED" })).toBe(false);
    expect(isEligibleForDeclaration({ idleDays: 5, status: "APPROVED" })).toBe(false);
    expect(isEligibleForDeclaration({ idleDays: 5, status: "SKIPPED" })).toBe(false);
    expect(isEligibleForDeclaration({ idleDays: 5, status: "SKIP_REPORTED" })).toBe(false);
  });
});

describe("constants", () => {
  it("IDLE_DAYS_THRESHOLD は 3", () => {
    expect(IDLE_DAYS_THRESHOLD).toBe(3);
  });

  it("DECLARATION_BONUS_XP は 1", () => {
    expect(DECLARATION_BONUS_XP).toBe(1);
  });
});
