import { isSetupComplete, getSetupGuideSteps } from "@/lib/setup-guide";
import type { SetupProgress } from "@/lib/setup-guide";

describe("isSetupComplete", () => {
  it("3つすべて true なら true を返す", () => {
    const p: SetupProgress = { hasChild: true, hasTask: true, childLoggedIn: true };
    expect(isSetupComplete(p)).toBe(true);
  });

  it("hasChild が false なら false を返す", () => {
    expect(isSetupComplete({ hasChild: false, hasTask: true, childLoggedIn: true })).toBe(false);
  });

  it("hasTask が false なら false を返す", () => {
    expect(isSetupComplete({ hasChild: true, hasTask: false, childLoggedIn: true })).toBe(false);
  });

  it("childLoggedIn が false なら false を返す", () => {
    expect(isSetupComplete({ hasChild: true, hasTask: true, childLoggedIn: false })).toBe(false);
  });

  it("すべて false なら false を返す", () => {
    expect(isSetupComplete({ hasChild: false, hasTask: false, childLoggedIn: false })).toBe(false);
  });
});

describe("getSetupGuideSteps", () => {
  it("3つのステップを返す", () => {
    expect(getSetupGuideSteps()).toHaveLength(3);
  });

  it("各ステップに step・title・description・href・progressKey がある", () => {
    const steps = getSetupGuideSteps();
    steps.forEach((s) => {
      expect(typeof s.step).toBe("number");
      expect(s.title).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.href).toBeTruthy();
      expect(s.progressKey).toBeTruthy();
    });
  });

  it("ステップ番号が 1, 2, 3 の順番になっている", () => {
    expect(getSetupGuideSteps().map((s) => s.step)).toEqual([1, 2, 3]);
  });

  it("progressKey が SetupProgress のキーに対応している", () => {
    const keys = getSetupGuideSteps().map((s) => s.progressKey);
    expect(keys).toContain("hasChild");
    expect(keys).toContain("hasTask");
    expect(keys).toContain("childLoggedIn");
  });

  it("ステップ1は子ユーザー作成（hasChild / ファミリー管理へのリンク）", () => {
    const s = getSetupGuideSteps()[0];
    expect(s.progressKey).toBe("hasChild");
    expect(s.href).toBe("/app/parent/family");
  });

  it("ステップ2はタスク作成（hasTask / タスク管理へのリンク）", () => {
    const s = getSetupGuideSteps()[1];
    expect(s.progressKey).toBe("hasTask");
    expect(s.href).toBe("/app/parent/tasks");
  });

  it("ステップ3は子供ログイン（childLoggedIn / ファミリー管理へのリンク）", () => {
    const s = getSetupGuideSteps()[2];
    expect(s.progressKey).toBe("childLoggedIn");
    expect(s.href).toBe("/app/parent/family");
  });
});
