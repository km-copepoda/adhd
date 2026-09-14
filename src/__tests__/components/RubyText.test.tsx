// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import RubyText from "@/components/RubyText";
import { stripRubyMarkup } from "@/lib/ruby";

describe("RubyText", () => {
  it("enabled=true: ruby/rt要素が描画され、rtの中身がふりがなと一致する", () => {
    const { container } = render(<RubyText text="これは{漢字:かんじ}です" enabled />);
    const rubyEl = container.querySelector("ruby");
    const rtEl = container.querySelector("rt");
    expect(rubyEl).not.toBeNull();
    expect(rtEl).not.toBeNull();
    expect(rtEl?.textContent).toBe("かんじ");
  });

  it("enabled=false: rt要素が存在せず、textContentがstripRubyMarkupの結果と一致する", () => {
    const text = "これは{漢字:かんじ}です";
    const { container } = render(<RubyText text={text} enabled={false} />);
    expect(container.querySelector("rt")).toBeNull();
    expect(container.textContent).toBe(stripRubyMarkup(text));
  });

  it("enabled true/falseどちらでも、ルビを除いた見た目上の本文は同一", () => {
    const text = "{今:きょ}{日:う}は{良:よ}い{天気:てんき}だ";
    const { container: enabledContainer } = render(<RubyText text={text} enabled />);
    const { container: disabledContainer } = render(<RubyText text={text} enabled={false} />);
    // <rt> は実 DOM 要素として container の子孫になるため（テスト1で要求されている挙動）、
    // enabledContainer.textContent には仕様上ふりがな読みも含まれる（DOM textContent はCSSの
    // display:none 等を考慮しないため、<rt> だけを textContent から除外することはできない）。
    // そのため、ルビ読みを取り除いた「ベーステキストのみ」を抽出して比較する。
    const rtTexts = Array.from(enabledContainer.querySelectorAll("rt")).map(
      (el) => el.textContent ?? "",
    );
    const enabledBaseOnly = rtTexts.reduce(
      (acc, rt) => acc.replace(rt, ""),
      enabledContainer.textContent ?? "",
    );
    expect(enabledBaseOnly).toBe(disabledContainer.textContent);
    expect(disabledContainer.textContent).toBe(stripRubyMarkup(text));
  });

  it("マークアップなしテキストは両モードでそのまま描画される", () => {
    const text = "ふつうのぶんしょう";
    const { container: enabledContainer } = render(<RubyText text={text} enabled />);
    const { container: disabledContainer } = render(<RubyText text={text} enabled={false} />);
    expect(enabledContainer.querySelector("ruby")).toBeNull();
    expect(enabledContainer.textContent).toBe(text);
    expect(disabledContainer.textContent).toBe(text);
  });

  it("className を渡した場合、ルート要素に反映される", () => {
    const { container } = render(
      <RubyText text="テスト" enabled={false} className="quote-text" />,
    );
    const root = container.firstElementChild;
    expect(root?.className).toContain("quote-text");
  });
});
