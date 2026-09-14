import { jstDateOf } from "@/lib/date";
import { QUOTES, type Quote } from "@/lib/quotes.data";

const DAY_MS = 86400000;

/**
 * JST 日付を起点に、`length` 件の格言リストから日替わりで表示するインデックスを返す。
 *
 * 曜日ではなく「エポックからの経過日数」を使うため、年またぎ・うるう年でも
 * 連続してローテーションする（`src/lib/date.ts` の JST 規約に準拠し `jstDateOf` を使う）。
 */
export function dailyQuoteIndex(date: Date, length: number): number {
  if (length <= 0) {
    throw new Error("dailyQuoteIndex: length must be a positive number");
  }
  const epochDay = Math.floor(jstDateOf(date).getTime() / DAY_MS);
  // 負の日数でも 0 以上の値になるよう、剰余を正規化する
  return ((epochDay % length) + length) % length;
}

/**
 * 当日の格言を返す。`date` / `quotes` を省略した場合は現在日時・`QUOTES` を使う。
 *
 * リストが空、または `date` が Invalid Date の場合は例外を投げず `null` を返す
 * （呼び出し側でカードを非表示にするだけで済むようにするため）。
 */
export function getDailyQuote(date: Date = new Date(), quotes: readonly Quote[] = QUOTES): Quote | null {
  if (quotes.length === 0) return null;
  if (Number.isNaN(date.getTime())) return null;
  const index = dailyQuoteIndex(date, quotes.length);
  return quotes[index];
}
