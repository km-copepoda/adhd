export type QuestTimeProgressBucket =
  | "NOT_STARTED" // 進捗 0%
  | "EARLY"       // 1〜79%
  | "ALMOST"      // 80〜99%
  | "DONE";       // 100% または対象クエストなし（通知不要）

export const QUEST_TIME_MESSAGES: Record<
  Exclude<QuestTimeProgressBucket, "DONE">,
  string[]
> = {
  NOT_STARTED: [
    "クエストタイムだよ！一緒にやろう！",
    "モンスターが待ちくたびれてるよ〜！",
    "今日のぼうけんを始めよう！",
  ],
  EARLY: [
    "あと一息！がんばろう！",
    "お宝までもう少しだ！",
    "順調だね！この調子！",
  ],
  ALMOST: [
    "あと1つ！あきらめないで！",
    "ラストスパート！",
    "パーフェクトは目の前だよ！",
  ],
};

export function getQuestTimeProgressBucket(
  done: number,
  total: number,
): QuestTimeProgressBucket {
  if (total <= 0) return "DONE";
  if (done >= total) return "DONE";
  if (done <= 0) return "NOT_STARTED";
  const pct = (done / total) * 100;
  if (pct >= 80) return "ALMOST";
  return "EARLY";
}

export function buildQuestTimeNotification(opts: {
  done: number;
  total: number;
  random?: () => number;
}): { title: string; body: string } | null {
  const bucket = getQuestTimeProgressBucket(opts.done, opts.total);
  if (bucket === "DONE") return null;

  const pool = QUEST_TIME_MESSAGES[bucket];
  const rand = opts.random ?? Math.random;
  const idx = Math.min(pool.length - 1, Math.floor(rand() * pool.length));
  return {
    title: "⏰ クエストタイム",
    body: pool[idx],
  };
}
