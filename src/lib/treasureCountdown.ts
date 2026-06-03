/**
 * 子クエスト画面に表示する「宝箱までの残数」モチベーションバナー用の純粋関数。
 *
 * フェーズ:
 *  - to_streak     : LOCKED 宝箱（minTasks 閾値）までの残数
 *  - to_all_complete: ALL_COMPLETE 宝箱（全タスク完了）までの残数
 *  - all_done      : 当日の宝箱トリガーをすべて満たした（褒め文言を出す）
 *  - none          : 今日のタスクが 0 件（バナーを出さない）
 *
 * minTasks > totalCount のケースでは LOCKED 閾値に永久到達できないため、
 * effectiveMinTasks = min(minTasks, totalCount) にクランプして
 * 「全完了 = 両方の宝箱獲得」とみなす。
 */

export const ALL_DONE_MESSAGES: readonly string[] = [
  "今日のごほうび全部出した！明日も頑張ろう！",
  "ぜんぶ達成！すごいね！",
  "今日のクエストはコンプリート！えらい！",
  "100% クリア！明日もこの調子！",
  "全部終わったよ！ゆっくり休もう！",
  "今日も完璧！その努力ぜったい力になってる！",
  "宝箱ぜんぶゲット！最強！",
  "がんばった！今日のキミは伝説級！",
  "ぜんぶおわった！ナイスファイト！",
  "今日も一日おつかれさま！明日もいっしょに冒険しよう！",
];

export type TreasureCountdown =
  | { kind: "none" }
  | { kind: "to_streak"; remaining: number; text: string }
  | { kind: "to_all_complete"; remaining: number; text: string }
  | { kind: "all_done"; messageIndex: number; text: string };

export function getTreasureCountdown(input: {
  completedCount: number;
  totalCount: number;
  minTasks: number;
  /** スキップ (SKIP_REPORTED + SKIPPED) 件数。> 0 なら ALL_COMPLETE 宝箱は boosted=false で出るため、訴求文言からレア確率UPを外す。 */
  skippedCount?: number;
  allDoneMessageIndex?: number;
}): TreasureCountdown {
  const { completedCount, totalCount, skippedCount = 0 } = input;
  if (totalCount <= 0) return { kind: "none" };

  const effectiveMinTasks = Math.min(Math.max(1, input.minTasks), totalCount);

  if (completedCount >= totalCount) {
    const idx = pickMessageIndex(input.allDoneMessageIndex);
    return {
      kind: "all_done",
      messageIndex: idx,
      text: ALL_DONE_MESSAGES[idx],
    };
  }

  if (completedCount >= effectiveMinTasks) {
    const remaining = totalCount - completedCount;
    const text =
      skippedCount > 0
        ? `宝箱まであと ${remaining} 個！`
        : `レア確率UPの宝箱まであと ${remaining} 個！`;
    return { kind: "to_all_complete", remaining, text };
  }

  const remaining = effectiveMinTasks - completedCount;
  return {
    kind: "to_streak",
    remaining,
    text: `宝箱出現まであと ${remaining} 個！`,
  };
}

function pickMessageIndex(raw: number | undefined): number {
  if (raw === undefined) {
    return Math.floor(Math.random() * ALL_DONE_MESSAGES.length);
  }
  const n = ALL_DONE_MESSAGES.length;
  return ((Math.trunc(raw) % n) + n) % n;
}
