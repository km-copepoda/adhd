/**
 * `{漢字:かんじ}` 形式のルビ（ふりがな）マークアップのパーサー。
 *
 * 純粋関数のみ。DB / React に依存しない（コード構成規約: ロジック区分）。
 */

export type RubySegment = { text: string; ruby?: string };

/**
 * `{base:ruby}` 形式のマークアップをセグメント列に分解する。
 *
 * 不正マークアップ（閉じ括弧なし・コロンなし・ルビ部が空）は無言で消さず、
 * `{...}` を含んだリテラル文字列としてそのままセグションに残す。
 *
 * 呼び出しごとに正規表現をローカルに生成するため、`g` フラグの `lastIndex`
 * 持ち越しバグ（モジュールスコープの正規表現定数を使い回すと起きる）が発生しない。
 */
export function parseRubyMarkup(text: string): RubySegment[] {
  const segments: RubySegment[] = [];
  const pattern = /\{([^{}]+)\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const [full, inner] = match;
    const start = match.index;

    if (start > lastIndex) {
      segments.push({ text: text.slice(lastIndex, start) });
    }

    const colonIndex = inner.indexOf(":");
    const hasValidColon = colonIndex > 0 && colonIndex < inner.length - 1;
    if (hasValidColon) {
      segments.push({
        text: inner.slice(0, colonIndex),
        ruby: inner.slice(colonIndex + 1),
      });
    } else {
      // コロンがない／ルビ部が空 → 不正マークアップとしてリテラルのまま残す
      segments.push({ text: full });
    }

    lastIndex = start + full.length;
  }

  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments;
}

/** ルビマークアップを取り除いた素のテキストを返す */
export function stripRubyMarkup(text: string): string {
  return parseRubyMarkup(text)
    .map((s) => s.text)
    .join("");
}
