import { getDailyQuote } from "@/lib/quotes";
import { QUOTES } from "@/lib/quotes.data";
import RubyText from "@/components/RubyText";

type DailyQuoteCardProps = {
  rubyEnabled: boolean;
  /** テスト容易性のためのオーバーライド。省略時は現在日時を使う。 */
  date?: Date;
};

/** 子供のクエスト画面に表示する日替わり格言カード */
export default function DailyQuoteCard({ rubyEnabled, date }: DailyQuoteCardProps) {
  const quote = getDailyQuote(date, QUOTES);
  if (!quote) return null;

  return (
    <div className="mb-4 rounded-xl border border-quest-border bg-quest-card px-4 py-3">
      <RubyText
        text={quote.text}
        kana={quote.textKana}
        enabled={rubyEnabled}
        className="block text-quest-text text-sm leading-relaxed"
      />
      <RubyText
        text={`— ${quote.author}`}
        kana={`— ${quote.authorKana}`}
        enabled={rubyEnabled}
        className="block text-quest-dim text-xs mt-1.5 text-right"
      />
    </div>
  );
}
