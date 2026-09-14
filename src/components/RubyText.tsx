import { parseRubyMarkup } from "@/lib/ruby";

type RubyTextProps = {
  text: string;
  enabled: boolean;
  className?: string;
};

/**
 * `{漢字:かんじ}` マークアップを含むテキストを描画する共有コンポーネント。
 *
 * `enabled=true` はルビ付きセグメントを `<ruby><rt>` で描画し、`enabled=false` は
 * セグメントの `text` だけを連結して描画する。正規表現によるマークアップ除去は
 * `@/lib/ruby` のパーサーに一本化し、ここでは再実装しない。
 */
export default function RubyText({ text, enabled, className }: RubyTextProps) {
  const segments = parseRubyMarkup(text);

  return (
    <span className={className}>
      {segments.map((segment, i) =>
        enabled && segment.ruby ? (
          <ruby key={i}>
            {segment.text}
            <rt>{segment.ruby}</rt>
          </ruby>
        ) : (
          <span key={i}>{segment.text}</span>
        ),
      )}
    </span>
  );
}
