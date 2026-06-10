import { describe, it, expect } from "vitest";
import { getStreakDisplayState } from "@/lib/streakDisplay";

describe("getStreakDisplayState", () => {
  const TODAY = "2026-06-10";

  it("streak が 0 のとき none を返す", () => {
    expect(getStreakDisplayState(0, null, TODAY)).toBe("none");
    expect(getStreakDisplayState(0, "2026-06-09", TODAY)).toBe("none");
  });

  it("streak > 0 でも lastAchievedDate が null なら none を返す（防御）", () => {
    expect(getStreakDisplayState(5, null, TODAY)).toBe("none");
  });

  it("負の streak は none を返す（防御）", () => {
    expect(getStreakDisplayState(-1, "2026-06-10", TODAY)).toBe("none");
  });

  it("lastAchievedDate が今日なら active", () => {
    expect(getStreakDisplayState(5, "2026-06-10", TODAY)).toBe("active");
    expect(getStreakDisplayState(1, "2026-06-10", TODAY)).toBe("active");
  });

  it("lastAchievedDate が昨日なら atRisk（今日まだ達成してない=途切れ警告）", () => {
    expect(getStreakDisplayState(5, "2026-06-09", TODAY)).toBe("atRisk");
  });

  it("lastAchievedDate が一昨日以前なら broken", () => {
    expect(getStreakDisplayState(5, "2026-06-08", TODAY)).toBe("broken");
    expect(getStreakDisplayState(5, "2026-05-01", TODAY)).toBe("broken");
  });

  it("月またぎで前日判定が正しい", () => {
    // 2026-03-01 の前日は 2026-02-28（うるう年でない）
    expect(getStreakDisplayState(3, "2026-02-28", "2026-03-01")).toBe("atRisk");
    expect(getStreakDisplayState(3, "2026-02-27", "2026-03-01")).toBe("broken");
  });

  it("年またぎで前日判定が正しい", () => {
    expect(getStreakDisplayState(3, "2025-12-31", "2026-01-01")).toBe("atRisk");
    expect(getStreakDisplayState(3, "2025-12-30", "2026-01-01")).toBe("broken");
  });

  it("うるう年の月またぎで前日判定が正しい（2024-03-01 の前日は 2024-02-29）", () => {
    expect(getStreakDisplayState(3, "2024-02-29", "2024-03-01")).toBe("atRisk");
    expect(getStreakDisplayState(3, "2024-02-28", "2024-03-01")).toBe("broken");
  });

  it("ISO 文字列の時刻部分は無視され、日付部分だけで比較される", () => {
    expect(getStreakDisplayState(5, "2026-06-10T00:00:00.000Z", TODAY)).toBe("active");
    expect(getStreakDisplayState(5, "2026-06-09T15:30:00.000Z", TODAY)).toBe("atRisk");
  });
});
