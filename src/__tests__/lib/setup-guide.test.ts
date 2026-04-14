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

  it("各ステップに step・title・description・href がある", () => {
    const steps = getSetupGuideSteps();
    steps.forEach((s) => {
      expect(typeof s.step).toBe("number");
      expect(s.title).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.href).toBeTruthy();
    });
  });

  it("ステップ番号が 1, 2, 3 の順番になっている", () => {
    const steps = getSetupGuideSteps();
    expect(steps.map((s) => s.step)).toEqual([1, 2, 3]);
  });

  it("ステップ1は子ユーザー作成（ファミリー管理へのリンク）", () => {
    const step1 = getSetupGuideSteps()[0];
    expect(step1.href).toBe("/app/parent/family");
  });

  it("ステップ2はタスク作成（タスク管理へのリンク）", () => {
    const step2 = getSetupGuideSteps()[1];
    expect(step2.href).toBe("/app/parent/tasks");
  });

  it("ステップ3は子供にコードを渡す（ファミリー管理へのリンク）", () => {
    const step3 = getSetupGuideSteps()[2];
    expect(step3.href).toBe("/app/parent/family");
  });
});
