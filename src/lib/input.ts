// 全角英数字・記号 → 半角に変換（タブレットIME対策）
// U+FF01 (！) 〜 U+FF5E (～) の範囲を 0xFEE0 減算で半角ASCIIに変換
export function toHalfWidth(str: string): string {
  return str.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}
