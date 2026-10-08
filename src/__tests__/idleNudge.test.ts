import { describe, it, expect } from "vitest";
import { getIdleNudgeText } from "@/lib/idleNudge";

describe("getIdleNudgeText", () => {
  it("ふりがなON: ひらがな表記を返す", () => {
    expect(getIdleNudgeText(true)).toBe("きょうやってみる？");
  });

  it("ふりがなOFF: 漢字表記を返す", () => {
    expect(getIdleNudgeText(false)).toBe("今日やってみる？");
  });

  it.each([true, false])("日数や「やってない」を含まない (rubyEnabled=%s)", (r) => {
    const t = getIdleNudgeText(r);
    expect(t).not.toMatch(/\d/);
    expect(t).not.toContain("日やってない");
    expect(t).not.toContain("やってないよ");
  });
});
