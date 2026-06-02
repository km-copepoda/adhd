// 全角英数字・記号 → 半角に変換（タブレットIME対策）
// U+FF01 (！) 〜 U+FF5E (～) の範囲を 0xFEE0 減算で半角ASCIIに変換
export function toHalfWidth(str: string): string {
  return str.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

// ファミリーコード入力欄の正規化: 半角化 → 大文字化 → 6 文字制限
export function normalizeFamilyCode(raw: string): string {
  return toHalfWidth(raw).toUpperCase().slice(0, 6);
}

// ユーザーコード入力欄の正規化: 半角化 → 数字のみ → 4 文字制限
export function normalizeChildCode(raw: string): string {
  return toHalfWidth(raw).replace(/\D/g, "").slice(0, 4);
}
