import { shouldShowReportHint } from "@/lib/quest-hint";

describe("shouldShowReportHint", () => {
  it("クエストがあり未報告のものがあり、ヒント未閲覧なら true を返す", () => {
    expect(shouldShowReportHint({ hasQuests: true, anyReported: false, hasSeen: false })).toBe(true);
  });

  it("ヒント閲覧済みなら false を返す", () => {
    expect(shouldShowReportHint({ hasQuests: true, anyReported: false, hasSeen: true })).toBe(false);
  });

  it("クエストがない場合は false を返す", () => {
    expect(shouldShowReportHint({ hasQuests: false, anyReported: false, hasSeen: false })).toBe(false);
  });

  it("すでに報告済みのクエストがある場合は false を返す", () => {
    expect(shouldShowReportHint({ hasQuests: true, anyReported: true, hasSeen: false })).toBe(false);
  });

  it("報告済みかつ閲覧済みなら false を返す", () => {
    expect(shouldShowReportHint({ hasQuests: true, anyReported: true, hasSeen: true })).toBe(false);
  });
});
