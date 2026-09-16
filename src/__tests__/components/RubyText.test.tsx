// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import RubyText from "@/components/RubyText";

describe("RubyText", () => {
  it("enabled=true: kana（ひらがな・カタカナ表記）が描画される", () => {
    const { container } = render(
      <RubyText text="今日は良い天気だ" kana="きょうはよいてんきだ" enabled />,
    );
    expect(container.textContent).toBe("きょうはよいてんきだ");
  });

  it("enabled=false: text（通常表記）が描画される", () => {
    const { container } = render(
      <RubyText text="今日は良い天気だ" kana="きょうはよいてんきだ" enabled={false} />,
    );
    expect(container.textContent).toBe("今日は良い天気だ");
  });

  it("text と kana が同じ場合、enabled の true/false どちらでも同じ見た目になる", () => {
    const { container: enabledContainer } = render(
      <RubyText text="トーマス・エジソン" kana="トーマス・エジソン" enabled />,
    );
    const { container: disabledContainer } = render(
      <RubyText text="トーマス・エジソン" kana="トーマス・エジソン" enabled={false} />,
    );
    expect(enabledContainer.textContent).toBe(disabledContainer.textContent);
  });

  it("className を渡した場合、ルート要素に反映される", () => {
    const { container } = render(
      <RubyText text="テスト" kana="てすと" enabled={false} className="quote-text" />,
    );
    const root = container.firstElementChild;
    expect(root?.className).toContain("quote-text");
  });

  it("kana が空文字の場合、enabled=true でも text にフォールバックする（Issue #139: pickRuby委譲後の仕様改善）", () => {
    const { container } = render(<RubyText text="今日は良い天気だ" kana="" enabled />);
    expect(container.textContent).toBe("今日は良い天気だ");
  });
});
