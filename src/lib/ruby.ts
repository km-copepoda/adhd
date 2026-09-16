// ふりがな表示の切り替えロジック（純粋関数）。
// src/components/RubyText.tsx の内部実装、および後続の CutsceneOverlay 等
// プレーン文字列を要求する箇所から共通で利用する（Issue #139）。

/**
 * `enabled` かつ `kana` が非空のときだけ `kana` を返し、それ以外は `text` を返す。
 * `kana` が空文字のときは `enabled` の値に関わらず `text` にフォールバックする。
 */
export function pickRuby(text: string, kana: string, enabled: boolean): string {
  return enabled && kana.length > 0 ? kana : text;
}
