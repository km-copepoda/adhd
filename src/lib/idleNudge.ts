// 子クエスト画面の「しばらくやっていないタスク」向け催促文言（純粋関数）。
// 日数を出さず、責めない言い回しにする（UX改善 #173）。
import { pickRuby } from "@/lib/ruby";

const IDLE_NUDGE_TEXT = "今日やってみる？";
const IDLE_NUDGE_KANA = "きょうやってみる？";

/** 「今日やる」案内の見出し文言。idleDays に関わらず日数は含めない。 */
export function getIdleNudgeText(rubyEnabled: boolean): string {
  return pickRuby(IDLE_NUDGE_TEXT, IDLE_NUDGE_KANA, rubyEnabled);
}
