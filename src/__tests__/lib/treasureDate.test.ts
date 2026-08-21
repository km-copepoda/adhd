import { describe, it, expect } from "vitest";
import { resolveTreasureDate } from "@/lib/treasureDate";
import { jstDateOf } from "@/lib/date";

// Issue #108: 「開かずの宝箱」バグの恒久修正。
// unlockTreasuresOnApprove(childId, date) の date は、生成時 (report/skip) と
// 承認時 (approve.ts) で別々に「今」を再計算していたため、carryOver=true のクエストで
// 報告日と承認日が別の暦日をまたぐと不一致になり、宝箱が永久に LOCKED のまま残っていた。
// resolveTreasureDate は「基準となる時刻 (at)」を呼び出し側が明示的に渡す純粋関数にすることで
// 生成側・承認側で同じ「基準日」を共有できるようにする。
describe("resolveTreasureDate", () => {
  it("carryOver=false の場合、at が questDate よりどれだけ先でも questDate をそのまま返す", () => {
    const questDate = new Date("2026-08-10T00:00:00.000Z");
    const at = new Date("2026-08-20T03:00:00.000Z"); // JST 2026-08-20 12:00
    expect(resolveTreasureDate(questDate, false, at)).toEqual(questDate);
  });

  it("carryOver=false の場合、at が questDate より過去でも questDate をそのまま返す（防御的）", () => {
    const questDate = new Date("2026-08-20T00:00:00.000Z");
    const at = new Date("2026-08-10T03:00:00.000Z");
    expect(resolveTreasureDate(questDate, false, at)).toEqual(questDate);
  });

  it("carryOver=true かつ questDate < jstDateOf(at) の場合、jstDateOf(at) を返す", () => {
    const questDate = new Date("2026-08-10T00:00:00.000Z");
    const at = new Date("2026-08-20T03:00:00.000Z"); // JST 2026-08-20 12:00
    expect(resolveTreasureDate(questDate, true, at)).toEqual(jstDateOf(at));
    expect(resolveTreasureDate(questDate, true, at)).toEqual(new Date("2026-08-20T00:00:00.000Z"));
  });

  it("carryOver=true かつ questDate === jstDateOf(at)（境界: 等号）の場合、questDate を返す", () => {
    const at = new Date("2026-08-20T03:00:00.000Z"); // JST 2026-08-20 12:00
    const questDate = jstDateOf(at); // 2026-08-20T00:00:00.000Z
    expect(resolveTreasureDate(questDate, true, at)).toEqual(questDate);
  });

  it("carryOver=true かつ questDate > jstDateOf(at)（未来日クエスト、通常起きないが防御的）の場合、questDate を返す", () => {
    const at = new Date("2026-08-20T03:00:00.000Z"); // JST 2026-08-20
    const questDate = new Date("2026-08-25T00:00:00.000Z"); // 未来日
    expect(resolveTreasureDate(questDate, true, at)).toEqual(questDate);
  });

  it("at が JST 23:59:59.999（UTC 14:59:59.999、日付切り替わり直前）の場合、その JST 日付として解決されること", () => {
    // JST 2026-08-20 23:59:59.999 = UTC 2026-08-20 14:59:59.999
    const at = new Date("2026-08-20T14:59:59.999Z");
    const questDate = new Date("2026-08-19T00:00:00.000Z"); // 過去日
    const expected = new Date("2026-08-20T00:00:00.000Z");
    expect(resolveTreasureDate(questDate, true, at)).toEqual(expected);
  });

  it("at が JST 0:00:00.000（UTC 15:00:00.000、日付切り替わり直後）の場合、その JST 日付として解決されること", () => {
    // JST 2026-08-21 00:00:00.000 = UTC 2026-08-20 15:00:00.000
    const at = new Date("2026-08-20T15:00:00.000Z");
    const questDate = new Date("2026-08-19T00:00:00.000Z"); // 過去日
    const expected = new Date("2026-08-21T00:00:00.000Z");
    expect(resolveTreasureDate(questDate, true, at)).toEqual(expected);
  });
});
