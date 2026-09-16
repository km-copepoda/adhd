"use client";

import CutsceneOverlay from "./CutsceneOverlay";
import { getDailyQuote } from "@/lib/quotes";

interface Props {
  currentStreak: number;
  onClose: () => void;
  rubyEnabled: boolean | null;
  quoteDate: Date | null;
  /** 子供ごとに表示を分散させるためのseed（ユーザーIDなど）。省略可。 */
  userId?: string;
}

const FALLBACK_DESCRIPTION = "今日もアプリを開けたね。えらい！";

export default function CheckinSuccessCutscene({
  currentStreak,
  onClose,
  rubyEnabled,
  quoteDate,
  userId,
}: Props) {
  const subtitle =
    currentStreak >= 2
      ? `🔥 ${currentStreak}日連続！`
      : currentStreak === 1
        ? "🔥 今日から連続スタート！"
        : undefined;

  const quote = quoteDate !== null ? getDailyQuote(quoteDate, undefined, userId) : null;
  const hasQuote = quote !== null && rubyEnabled !== null;
  const description = hasQuote
    ? rubyEnabled
      ? `${quote.textKana} — ${quote.authorKana}`
      : `${quote.text} — ${quote.author}`
    : FALLBACK_DESCRIPTION;

  return (
    <CutsceneOverlay
      onClose={onClose}
      emoji="🌟"
      glowColor="rgba(253,224,71,0.85)"
      title="チェックイン成功！"
      titleColor="text-yellow-300"
      subtitle={subtitle}
      subtitleColor="text-orange-300"
      description={description}
      descriptionClassName={
        hasQuote
          ? "text-quest-gold text-base font-medium text-center leading-relaxed mb-6 max-w-sm"
          : undefined
      }
    />
  );
}
