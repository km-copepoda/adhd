import { describe, it, expect } from "vitest";
import {
  ACCOUNT_DELETE_CONFIRM_TEXT,
  isDeleteConfirmed,
  hasBlockingSubscription,
} from "@/lib/accountDeletion.data";

const NOW = new Date("2026-10-23T00:00:00.000Z");
const FUTURE = new Date(NOW.getTime() + 1);
const PAST = new Date(NOW.getTime() - 1);

type Sub = Parameters<typeof hasBlockingSubscription>[0];
const sub = (o: Partial<NonNullable<Sub>> = {}): NonNullable<Sub> => ({
  plan: "PREMIUM",
  currentPeriodEnd: FUTURE,
  canceledAt: null,
  ...o,
});

describe("ACCOUNT_DELETE_CONFIRM_TEXT", () => {
  it("確認文字列は「削除します」であること", () => {
    expect(ACCOUNT_DELETE_CONFIRM_TEXT).toBe("削除します");
  });
});

describe("isDeleteConfirmed", () => {
  it("完全一致なら true", () => {
    expect(isDeleteConfirmed("削除します")).toBe(true);
  });

  it("前後の空白・改行は trim して一致とみなす", () => {
    expect(isDeleteConfirmed("  削除します  ")).toBe(true);
    expect(isDeleteConfirmed("\n削除します\t")).toBe(true);
    expect(isDeleteConfirmed("　削除します　")).toBe(true);
  });

  it.each([
    ["空文字", ""],
    ["空白のみ", "   "],
    ["一部だけ", "削除"],
    ["余分な文字", "削除します。"],
    ["間に空白", "削除 します"],
    ["英語", "delete"],
    ["前方に余分な文字", "はい削除します"],
  ])("不一致（%s）は false", (_label, input) => {
    expect(isDeleteConfirmed(input)).toBe(false);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["数値", 123],
    ["真偽値", true],
    ["配列", ["削除します"]],
    ["オブジェクト", { toString: () => "削除します" }],
  ])("文字列以外（%s）は false", (_label, input) => {
    expect(isDeleteConfirmed(input)).toBe(false);
  });
});

describe("hasBlockingSubscription", () => {
  it("レコード無し（null）は false", () => {
    expect(hasBlockingSubscription(null, NOW)).toBe(false);
  });

  it("FREE は false", () => {
    expect(hasBlockingSubscription(sub({ plan: "FREE", currentPeriodEnd: null }), NOW)).toBe(false);
  });

  it("PREMIUM・期間内・未解約は true", () => {
    expect(hasBlockingSubscription(sub(), NOW)).toBe(true);
  });

  it("PREMIUM・期限なし（手動付与）・未解約は true", () => {
    expect(hasBlockingSubscription(sub({ currentPeriodEnd: null }), NOW)).toBe(true);
  });

  it("PREMIUM でも解約済み（canceledAt あり）なら期間内でも false", () => {
    expect(hasBlockingSubscription(sub({ canceledAt: PAST }), NOW)).toBe(false);
    expect(hasBlockingSubscription(sub({ canceledAt: PAST, currentPeriodEnd: null }), NOW)).toBe(false);
  });

  it("期限切れ PREMIUM は false", () => {
    expect(hasBlockingSubscription(sub({ currentPeriodEnd: PAST }), NOW)).toBe(false);
  });

  it("境界: currentPeriodEnd が now ちょうどなら期限切れ扱いで false、1ms 先なら true", () => {
    expect(hasBlockingSubscription(sub({ currentPeriodEnd: new Date(NOW) }), NOW)).toBe(false);
    expect(hasBlockingSubscription(sub({ currentPeriodEnd: FUTURE }), NOW)).toBe(true);
  });
});
