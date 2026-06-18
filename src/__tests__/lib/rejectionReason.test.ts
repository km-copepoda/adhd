import { describe, it, expect } from "vitest";
import {
  isSystemRejectionReason,
  displayRejectionReason,
} from "@/lib/rejectionReason";

describe("isSystemRejectionReason", () => {
  it("DUPLICATE_PENDING_CLEANUP は system 判定", () => {
    expect(isSystemRejectionReason("DUPLICATE_PENDING_CLEANUP")).toBe(true);
  });

  it("STALE_CARRYOVER_CLEANUP は system 判定", () => {
    expect(isSystemRejectionReason("STALE_CARRYOVER_CLEANUP")).toBe(true);
  });

  it("親が手動で入力した理由は system 判定ではない", () => {
    expect(isSystemRejectionReason("写真が暗いよ")).toBe(false);
    expect(isSystemRejectionReason("もう一回")).toBe(false);
  });

  it("null / undefined / 空文字は system 判定ではない", () => {
    expect(isSystemRejectionReason(null)).toBe(false);
    expect(isSystemRejectionReason(undefined)).toBe(false);
    expect(isSystemRejectionReason("")).toBe(false);
  });
});

describe("displayRejectionReason", () => {
  it("system 由来は null を返す（生文字を表示しない）", () => {
    expect(displayRejectionReason("DUPLICATE_PENDING_CLEANUP")).toBeNull();
    expect(displayRejectionReason("STALE_CARRYOVER_CLEANUP")).toBeNull();
  });

  it("親入力の理由はそのまま返す", () => {
    expect(displayRejectionReason("写真が暗いよ")).toBe("写真が暗いよ");
  });

  it("null / undefined / 空文字は null を返す", () => {
    expect(displayRejectionReason(null)).toBeNull();
    expect(displayRejectionReason(undefined)).toBeNull();
    expect(displayRejectionReason("")).toBeNull();
  });
});
