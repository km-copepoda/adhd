import { jstDateOf } from "@/lib/date";
import { QUOTES, type Quote } from "@/lib/quotes.data";

const DAY_MS = 86400000;

/**
 * `epochDay` を種とする決定的な 32bit 整数ハッシュ（Murmur3 風の finalizer）。
 *
 * 常に 0 以上の uint32 を返すため、呼び出し側で `% length` した結果も
 * 常に非負になる（負数正規化が不要）。
 */
function hashEpochDay(epochDay: number): number {
  let x = epochDay >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = (x ^ (x >>> 16)) >>> 0;
  return x;
}

/**
 * JST 日付を起点に、`length` 件の格言リストから日替わりで表示するインデックスを返す。
 *
 * 「エポックからの経過日数」を種に `hashEpochDay` でハッシュ化してから `length` で割った
 * 余りを使うため、単純な `epochDay % length` と比べて連続する日付間でもインデックスが
 * 分散する（隣り合う日が近いインデックスに偏らない）。日付とリスト長が同じであれば
 * 常に同じインデックスを返す（決定性）契約は維持している
 * （`src/lib/date.ts` の JST 規約に準拠し `jstDateOf` を使う）。
 */
export function dailyQuoteIndex(date: Date, length: number): number {
  if (length <= 0) {
    throw new Error("dailyQuoteIndex: length must be a positive number");
  }
  const epochDay = Math.floor(jstDateOf(date).getTime() / DAY_MS);
  return hashEpochDay(epochDay) % length;
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
