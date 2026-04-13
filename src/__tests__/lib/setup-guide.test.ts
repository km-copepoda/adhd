import { shouldShowSetupGuide, getSetupGuideSteps } from "@/lib/setup-guide";

describe("shouldShowSetupGuide", () => {
  it("未閲覧なら true を返す", () => {
    expect(shouldShowSetupGuide(false)).toBe(true);
  });

  it("閲覧済みなら false を返す", () => {
    expect(shouldShowSetupGuide(true)).toBe(false);
  });
});

describe("getSetupGuideSteps", () => {
  it("3つのステップを返す", () => {
    expect(getSetupGuideSteps()).toHaveLength(3);
  });

  it("各ステップに step・title・description がある", () => {
    const steps = getSetupGuideSteps();
    steps.forEach((s) => {
      expect(typeof s.step).toBe("number");
      expect(s.title).toBeTruthy();
      expect(s.description).toBeTruthy();
    });
  });

  it("ステップ番号が 1, 2, 3 の順番になっている", () => {
    const steps = getSetupGuideSteps();
    expect(steps.map((s) => s.step)).toEqual([1, 2, 3]);
  });
});
