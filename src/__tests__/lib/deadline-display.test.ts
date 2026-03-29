import { describe, it, expect } from "vitest";
import { getDeadlineDisplay } from "@/lib/date";

describe("getDeadlineDisplay", () => {
  // now は UTC 時刻で渡す。JST = UTC+9
  // 今日 JST: 2026-03-28 → UTC 2026-03-27T15:00:00Z ~ 2026-03-28T14:59:59Z

  it("2時間以上前は normal を返す", () => {
    // 17:00 JST = 08:00 UTC, deadline 20:00 JST → 残り180分
    const now = new Date("2026-03-28T08:00:00Z");
    const result = getDeadlineDisplay("20:00", now);
    expect(result.minutesLeft).toBe(180);
    expect(result.urgency).toBe("normal");
  });

  it("残り59分は warning を返す", () => {
    // 19:01 JST = 10:01 UTC, deadline 20:00 → 残り59分
    const now = new Date("2026-03-28T10:01:00Z");
    const result = getDeadlineDisplay("20:00", now);
    expect(result.minutesLeft).toBe(59);
    expect(result.urgency).toBe("warning");
  });

  it("残り29分は danger を返す", () => {
    // 19:31 JST = 10:31 UTC, deadline 20:00 → 残り29分
    const now = new Date("2026-03-28T10:31:00Z");
    const result = getDeadlineDisplay("20:00", now);
    expect(result.minutesLeft).toBe(29);
    expect(result.urgency).toBe("danger");
  });

  it("期限ちょうどは expired を返す", () => {
    // 20:00 JST = 11:00 UTC
    const now = new Date("2026-03-28T11:00:00Z");
    const result = getDeadlineDisplay("20:00", now);
    expect(result.minutesLeft).toBe(0);
    expect(result.urgency).toBe("expired");
  });

  it("期限を過ぎたら expired を返す（minutesLeft は負）", () => {
    // 21:00 JST = 12:00 UTC
    const now = new Date("2026-03-28T12:00:00Z");
    const result = getDeadlineDisplay("20:00", now);
    expect(result.minutesLeft).toBe(-60);
    expect(result.urgency).toBe("expired");
  });

  it("残り60分ちょうどは normal と warning の境界 → warning", () => {
    // 19:00 JST = 10:00 UTC, deadline 20:00 → 残り60分
    const now = new Date("2026-03-28T10:00:00Z");
    const result = getDeadlineDisplay("20:00", now);
    expect(result.minutesLeft).toBe(60);
    expect(result.urgency).toBe("warning");
  });

  it("残り30分ちょうどは warning と danger の境界 → danger", () => {
    // 19:30 JST = 10:30 UTC, deadline 20:00 → 残り30分
    const now = new Date("2026-03-28T10:30:00Z");
    const result = getDeadlineDisplay("20:00", now);
    expect(result.minutesLeft).toBe(30);
    expect(result.urgency).toBe("danger");
  });
});
