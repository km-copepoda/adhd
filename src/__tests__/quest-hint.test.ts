import { describe, it, expect } from "vitest";
import { shouldShowReportHint } from "@/lib/quest-hint";

const base = { hasQuests: true, anyReported: false, hasSeen: false, hasEverReported: false };

describe("shouldShowReportHint", () => {
  it("全条件を満たす場合は表示", () => {
    expect(shouldShowReportHint(base)).toBe(true);
  });

  it("hasSeen=true なら非表示", () => {
    expect(shouldShowReportHint({ ...base, hasSeen: true })).toBe(false);
  });

  it("hasEverReported=true なら非表示", () => {
    expect(shouldShowReportHint({ ...base, hasEverReported: true })).toBe(false);
  });

  it("hasQuests=false なら非表示", () => {
    expect(shouldShowReportHint({ ...base, hasQuests: false })).toBe(false);
  });

  it("anyReported=true なら非表示", () => {
    expect(shouldShowReportHint({ ...base, anyReported: true })).toBe(false);
  });
});
