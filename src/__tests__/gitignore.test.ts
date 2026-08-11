import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe(".gitignore", () => {
  it("Pythonのバイトコードキャッシュ（__pycache__）を除外する", () => {
    const content = readFileSync(join(process.cwd(), ".gitignore"), "utf-8");
    expect(content).toMatch(/__pycache__/);
  });
});
