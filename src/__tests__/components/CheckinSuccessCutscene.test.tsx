// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CheckinSuccessCutscene from "@/components/child/CheckinSuccessCutscene";
import { getDailyQuote } from "@/lib/quotes";
import { QUOTES } from "@/lib/quotes.data";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

const FIXED_QUOTE_DATE = new Date("2026-01-01T00:00:00Z");
const FALLBACK_TEXT = "今日もアプリを開けたね。えらい！";

describe("CheckinSuccessCutscene チェックイン成功演出", () => {
  it("「チェックイン成功！」のタイトルを表示する", () => {
    render(
      <CheckinSuccessCutscene
        currentStreak={1}
        onClose={() => {}}
        rubyEnabled={false}
        quoteDate={null}
      />,
    );
    expect(screen.getByText("チェックイン成功！")).toBeTruthy();
  });

  it("currentStreak >= 2 なら『N日連続！』を表示する", () => {
    render(
      <CheckinSuccessCutscene
        currentStreak={5}
        onClose={() => {}}
        rubyEnabled={false}
        quoteDate={null}
      />,
    );
    expect(screen.getByText(/5日連続/)).toBeTruthy();
  });

  it("currentStreak === 1 なら『連続スタート』など 1日目を強調する文言を表示する", () => {
    render(
      <CheckinSuccessCutscene
        currentStreak={1}
        onClose={() => {}}
        rubyEnabled={false}
        quoteDate={null}
      />,
    );
    // 1日連続！はやや不自然なので「連続スタート」などの文言を許容
    const hasOne = screen.queryByText(/1日連続/);
    const hasStart = screen.queryByText(/連続スタート|今日から/);
    expect(hasOne || hasStart).toBeTruthy();
  });

  it("タップで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    const { container } = render(
      <CheckinSuccessCutscene
        currentStreak={3}
        onClose={onClose}
        rubyEnabled={false}
        quoteDate={null}
      />,
    );
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onClose).toHaveBeenCalled();
  });

  it("currentStreak === 0 でもクラッシュせずタイトルを表示する（境界値）", () => {
    render(
      <CheckinSuccessCutscene
        currentStreak={0}
        onClose={() => {}}
        rubyEnabled={false}
        quoteDate={null}
      />,
    );
    expect(screen.getByText("チェックイン成功！")).toBeTruthy();
  });

  describe("当日の格言表示", () => {
    it("rubyEnabled=false のとき text/author 形式（通常表記）の格言を表示する", () => {
      const quote = getDailyQuote(FIXED_QUOTE_DATE);
      expect(quote).not.toBeNull();
      render(
        <CheckinSuccessCutscene
          currentStreak={1}
          onClose={() => {}}
          rubyEnabled={false}
          quoteDate={FIXED_QUOTE_DATE}
        />,
      );
      expect(
        screen.getByText(`${quote!.text} — ${quote!.author}`),
      ).toBeTruthy();
      expect(screen.queryByText(FALLBACK_TEXT)).toBeNull();
    });

    it("rubyEnabled=true のとき textKana/authorKana 形式（かな表記）の格言を表示する", () => {
      const quote = getDailyQuote(FIXED_QUOTE_DATE);
      expect(quote).not.toBeNull();
      render(
        <CheckinSuccessCutscene
          currentStreak={1}
          onClose={() => {}}
          rubyEnabled={true}
          quoteDate={FIXED_QUOTE_DATE}
        />,
      );
      expect(
        screen.getByText(`${quote!.textKana} — ${quote!.authorKana}`),
      ).toBeTruthy();
      expect(screen.queryByText(FALLBACK_TEXT)).toBeNull();
    });

    it("quoteDate が null のとき固定文言にフォールバックする", () => {
      render(
        <CheckinSuccessCutscene
          currentStreak={1}
          onClose={() => {}}
          rubyEnabled={false}
          quoteDate={null}
        />,
      );
      expect(screen.getByText(FALLBACK_TEXT)).toBeTruthy();
    });

    it("rubyEnabled が null のとき固定文言にフォールバックする", () => {
      render(
        <CheckinSuccessCutscene
          currentStreak={1}
          onClose={() => {}}
          rubyEnabled={null}
          quoteDate={FIXED_QUOTE_DATE}
        />,
      );
      expect(screen.getByText(FALLBACK_TEXT)).toBeTruthy();
    });

    it("quoteDate が Invalid Date（getDailyQuote が null を返す）のとき固定文言にフォールバックする（境界値）", () => {
      const invalidDate = new Date(NaN);
      expect(getDailyQuote(invalidDate)).toBeNull();
      render(
        <CheckinSuccessCutscene
          currentStreak={1}
          onClose={() => {}}
          rubyEnabled={false}
          quoteDate={invalidDate}
        />,
      );
      expect(screen.getByText(FALLBACK_TEXT)).toBeTruthy();
    });

    it("格言表示時は目立つスタイル（text-quest-gold）が適用される", () => {
      const quote = getDailyQuote(FIXED_QUOTE_DATE);
      render(
        <CheckinSuccessCutscene
          currentStreak={1}
          onClose={() => {}}
          rubyEnabled={false}
          quoteDate={FIXED_QUOTE_DATE}
        />,
      );
      const el = screen.getByText(`${quote!.text} — ${quote!.author}`);
      expect(el.className).toContain("text-quest-gold");
    });

    it("固定文言フォールバック時は目立つスタイルを適用しない（既存の控えめな見た目のまま）", () => {
      render(
        <CheckinSuccessCutscene
          currentStreak={1}
          onClose={() => {}}
          rubyEnabled={false}
          quoteDate={null}
        />,
      );
      const el = screen.getByText(FALLBACK_TEXT);
      expect(el.className).not.toContain("text-quest-gold");
    });

    it("userIdありの場合、同じ日付でもuserId未指定時とは異なる（seedを反映した）格言が表示される", () => {
      // ゴールデン値: FIXED_QUOTE_DATE(epochDay=20454) で
      // seedなし→QUOTES[103]、seed="test-child-id"→QUOTES[1] になることを事前計算済み
      const withoutSeed = getDailyQuote(FIXED_QUOTE_DATE);
      const withSeed = getDailyQuote(FIXED_QUOTE_DATE, QUOTES, "test-child-id");
      expect(withoutSeed).not.toBeNull();
      expect(withSeed).not.toBeNull();
      expect(withSeed).not.toEqual(withoutSeed);

      render(
        <CheckinSuccessCutscene
          currentStreak={1}
          onClose={() => {}}
          rubyEnabled={false}
          quoteDate={FIXED_QUOTE_DATE}
          userId="test-child-id"
        />,
      );
      expect(
        screen.getByText(`${withSeed!.text} — ${withSeed!.author}`),
      ).toBeTruthy();
      expect(
        screen.queryByText(`${withoutSeed!.text} — ${withoutSeed!.author}`),
      ).toBeNull();
    });

    it("userId未指定(undefined)の場合は従来通りseedなしの格言が表示される", () => {
      const withoutSeed = getDailyQuote(FIXED_QUOTE_DATE);
      expect(withoutSeed).not.toBeNull();
      render(
        <CheckinSuccessCutscene
          currentStreak={1}
          onClose={() => {}}
          rubyEnabled={false}
          quoteDate={FIXED_QUOTE_DATE}
        />,
      );
      expect(
        screen.getByText(`${withoutSeed!.text} — ${withoutSeed!.author}`),
      ).toBeTruthy();
    });
  });
});
