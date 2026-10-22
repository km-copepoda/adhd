import { describe, it, expect } from "vitest";
import { tomorrowStringJST, dayOfWeekJST } from "@/lib/date";

describe("tomorrowStringJST (Issue #191)", () => {
  it("JST 08:59（UTC 前日 23:59）でも JST 基準の翌日を返す", () => {
    // JST 2026-03-12 08:59 = UTC 2026-03-11 23:59
    expect(tomorrowStringJST(new Date("2026-03-11T23:59:00Z"))).toBe("2026-03-13");
  });
  it("JST 09:00（UTC 0:00）で翌日を返す", () => {
    expect(tomorrowStringJST(new Date("2026-03-12T00:00:00Z"))).toBe("2026-03-13");
  });
  it("JST 23:59 で翌日を返す", () => {
    // JST 2026-03-12 23:59 = UTC 2026-03-12 14:59
    expect(tomorrowStringJST(new Date("2026-03-12T14:59:00Z"))).toBe("2026-03-13");
  });
  it("JST 0:00 で翌日を返す", () => {
    // JST 2026-03-13 00:00 = UTC 2026-03-12 15:00
    expect(tomorrowStringJST(new Date("2026-03-12T15:00:00Z"))).toBe("2026-03-14");
  });
  it("月末を跨ぐ", () => {
    expect(tomorrowStringJST(new Date("2026-01-31T03:00:00Z"))).toBe("2026-02-01");
  });
  it("年末を跨ぐ", () => {
    expect(tomorrowStringJST(new Date("2026-12-31T03:00:00Z"))).toBe("2027-01-01");
  });
  it("うるう日を跨ぐ", () => {
    expect(tomorrowStringJST(new Date("2028-02-28T03:00:00Z"))).toBe("2028-02-29");
  });
});

describe("dayOfWeekJST(now) (Issue #191)", () => {
  it("JST 日曜 0:00（UTC 土曜 15:00）は 0", () => {
    expect(dayOfWeekJST(new Date("2026-03-14T15:00:00Z"))).toBe(0);
  });
  it("JST 土曜 23:59（UTC 土曜 14:59）は 6", () => {
    expect(dayOfWeekJST(new Date("2026-03-14T14:59:00Z"))).toBe(6);
  });
});
