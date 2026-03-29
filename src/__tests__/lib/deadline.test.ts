import { describe, it, expect } from "vitest";
import { isBeforeDeadline } from "@/lib/date";

describe("isBeforeDeadline", () => {
  // questDate は todayJST() が返す形式: JST日付をUTC 0時として保存
  // 例: 2026-03-28 JST → 2026-03-28T00:00:00.000Z

  const questDate = new Date("2026-03-28T00:00:00.000Z"); // 2026-03-28 JST

  it("期限前の報告はtrueを返す", () => {
    // 18:30 JST = 09:30 UTC、deadline 20:00 JST
    const reportedAt = new Date("2026-03-28T09:30:00Z");
    expect(isBeforeDeadline(reportedAt, questDate, "20:00")).toBe(true);
  });

  it("期限後の報告はfalseを返す", () => {
    // 21:30 JST = 12:30 UTC
    const reportedAt = new Date("2026-03-28T12:30:00Z");
    expect(isBeforeDeadline(reportedAt, questDate, "20:00")).toBe(false);
  });

  it("期限ちょうどはfalseを返す（境界値）", () => {
    // 20:00 JST = 11:00 UTC
    const reportedAt = new Date("2026-03-28T11:00:00Z");
    expect(isBeforeDeadline(reportedAt, questDate, "20:00")).toBe(false);
  });

  it("1分前はtrueを返す", () => {
    // 19:59 JST = 10:59 UTC
    const reportedAt = new Date("2026-03-28T10:59:00Z");
    expect(isBeforeDeadline(reportedAt, questDate, "20:00")).toBe(true);
  });

  it("深夜デッドライン（23:30）で23:29 JSTはtrue", () => {
    // 23:29 JST = 14:29 UTC
    const reportedAt = new Date("2026-03-28T14:29:00Z");
    expect(isBeforeDeadline(reportedAt, questDate, "23:30")).toBe(true);
  });

  it("深夜デッドライン（23:30）で23:31 JSTはfalse", () => {
    // 23:31 JST = 14:31 UTC
    const reportedAt = new Date("2026-03-28T14:31:00Z");
    expect(isBeforeDeadline(reportedAt, questDate, "23:30")).toBe(false);
  });

  it("早朝デッドライン（09:00 JST）で08:59 JSTはtrue", () => {
    // 08:59 JST = 23:59 UTC前日 = 2026-03-27T23:59:00Z
    const reportedAt = new Date("2026-03-27T23:59:00Z");
    expect(isBeforeDeadline(reportedAt, questDate, "09:00")).toBe(true);
  });

  it("早朝デッドライン（09:00 JST）で09:01 JSTはfalse", () => {
    // 09:01 JST = 00:01 UTC = 2026-03-28T00:01:00Z
    const reportedAt = new Date("2026-03-28T00:01:00Z");
    expect(isBeforeDeadline(reportedAt, questDate, "09:00")).toBe(false);
  });
});
