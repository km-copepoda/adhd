// 全角英数字・記号 → 半角に変換（タブレットIME対策）
// U+FF01 (！) 〜 U+FF5E (～) の範囲を 0xFEE0 減算で半角ASCIIに変換
export function toHalfWidth(str: string): string {
  return str.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/** ログインコードに使える文字（紛らわしい I, O, 0, 1 を除いた32文字種） */
export const LOGIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// ログインコードの正規化（crypto に依存しないのでクライアントからも使える）:
// 半角化 → 大文字化 → 許可文字以外を除去。長さの切り詰めはしない（呼び出し側で長さを検証する）
export function normalizeLoginCodeText(raw: string): string {
  return toHalfWidth(raw)
    .toUpperCase()
    .replace(new RegExp(`[^${LOGIN_CODE_CHARS}]`, "g"), "");
}
