// Issue #160: 説明文用トークン --color-quest-muted の定義とコントラスト検証
import { readFileSync } from "fs";
import path from "path";
import { describe, it, expect } from "vitest";

const css = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

function tokenValue(name: string): string | null {
  const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  return m ? m[1].toLowerCase() : null;
}

function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

describe("globals.css: --color-quest-muted", () => {
  it("--color-quest-muted が定義されている", () => {
    expect(tokenValue("quest-muted")).not.toBeNull();
  });

  it("--color-quest-dim の値は #555a72 のまま変更されていない", () => {
    expect(tokenValue("quest-dim")).toBe("#555a72");
  });

  it("quest-muted は quest-dim と異なる値である", () => {
    expect(tokenValue("quest-muted")).not.toBe(tokenValue("quest-dim"));
  });

  it("quest-muted は card 背景(#131828)に対し 4.5:1 以上", () => {
    const muted = tokenValue("quest-muted");
    expect(muted).not.toBeNull();
    expect(contrast(muted!, "#131828")).toBeGreaterThanOrEqual(4.5);
  });

  it("quest-muted は bg 背景(#07080f)に対し 4.5:1 以上", () => {
    const muted = tokenValue("quest-muted");
    expect(muted).not.toBeNull();
    expect(contrast(muted!, "#07080f")).toBeGreaterThanOrEqual(4.5);
  });

  it("参考: quest-dim は 4.5:1 未満（旧状態の問題確認）", () => {
    expect(contrast("#555a72", "#131828")).toBeLessThan(4.5);
  });
});
