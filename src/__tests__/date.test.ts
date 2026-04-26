import { describe, expect, it } from "vitest";
import { isTaskStreakActive } from "@/lib/date";

describe("isTaskStreakActive", () => {
  const TODAY = "2026-04-26";
  const YESTERDAY = "2026-04-25";
  const TWO_DAYS_AGO = "2026-04-24";
  const ONE_WEEK_AGO = "2026-04-19";

  it("null なら false", () => {
    expect(isTaskStreakActive(null, TODAY)).toBe(false);
  });

  it("今日なら true", () => {
    expect(isTaskStreakActive(TODAY, TODAY)).toBe(true);
  });

  it("昨日なら true", () => {
    expect(isTaskStreakActive(YESTERDAY, TODAY)).toBe(true);
  });

  it("2日前なら false", () => {
    expect(isTaskStreakActive(TWO_DAYS_AGO, TODAY)).toBe(false);
  });

  it("1週間前なら false", () => {
    expect(isTaskStreakActive(ONE_WEEK_AGO, TODAY)).toBe(false);
  });

  it("@db.Date 形式（T00:00:00.000Z サフィックス付き）でも正しく判定できる", () => {
    expect(isTaskStreakActive(YESTERDAY + "T00:00:00.000Z", TODAY)).toBe(true);
    expect(isTaskStreakActive(TWO_DAYS_AGO + "T00:00:00.000Z", TODAY)).toBe(false);
  });
});
