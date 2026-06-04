import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CSS_PATH = resolve(__dirname, "../../app/lp.module.css");
const css = readFileSync(CSS_PATH, "utf-8");

/**
 * Hero セクションで `.heroScroll` (画面下部の SCROLL ヒント) が
 * `.heroCta` のボタン群と視覚的に重ならないことを担保するテスト。
 *
 * 重なりが起きる原因: `.hero` が min-height: 100vh で、`.heroScroll` が
 * position: absolute; bottom: 40px に置かれているため、ビューポート高さが
 * 短い場合は CTA ボタンが画面中央近くに来て SCROLL と重なる。
 *
 * 対策:
 *   (a) .hero の padding-bottom を増やし、コンテンツと SCROLL の間に余白を確保
 *   (b) 縦に短いビューポートでは .heroScroll を非表示にする (@media max-height)
 */

function extractRuleBody(selector: string): string {
  // selector の "." は regex の wildcard なので "\\." にエスケープしてから RegExp 化
  const escaped = selector.replace(/\./g, "\\.");
  const regex = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`);
  const m = css.match(regex);
  return m ? m[1] : "";
}

describe("LP HERO scroll hint overlap", () => {
  it(".hero の padding 指定が左右と上下とで分かれており、bottom 側が十分に確保されている", () => {
    const body = extractRuleBody(".hero");
    expect(body).toMatch(/padding\s*:/);
    // padding が "T R B L" 形式または "TB LR" 形式どちらでも、
    // 縦方向（top/bottom）が 120px 以上になっていることを担保
    const paddingMatch = body.match(/padding\s*:\s*([^;]+);/);
    expect(paddingMatch).not.toBeNull();
    const paddingValue = paddingMatch![1].trim();
    const tokens = paddingValue.split(/\s+/);
    let bottomToken = "0px";
    if (tokens.length === 4) {
      bottomToken = tokens[2];
    } else if (tokens.length === 3) {
      bottomToken = tokens[2];
    } else if (tokens.length === 2) {
      bottomToken = tokens[0]; // TB
    } else {
      bottomToken = tokens[0];
    }
    const pxValue = parseInt(bottomToken.replace(/[^0-9]/g, ""), 10);
    expect(pxValue).toBeGreaterThanOrEqual(120);
  });

  it("縦に短いビューポートでは .heroScroll を非表示にする @media (max-height) が定義されている", () => {
    // @media (max-height: …) { … .heroScroll { … display: none … } … }
    const mediaRegex = /@media\s*\([^)]*max-height[^)]*\)\s*\{[\s\S]*?\.heroScroll\s*\{[\s\S]*?display\s*:\s*none/;
    expect(css).toMatch(mediaRegex);
  });
});
