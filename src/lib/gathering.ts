export type GatheringLocationType = "PARK" | "COMMUNITY_CENTER" | "SCHOOL";

export const LOCATION_CAPACITY: Record<GatheringLocationType, number> = {
  PARK: 10,
  COMMUNITY_CENTER: 30,
  SCHOOL: 50,
};

export const LOCATION_LABEL: Record<GatheringLocationType, string> = {
  PARK: "公園",
  COMMUNITY_CENTER: "児童館",
  SCHOOL: "校庭",
};

export const LOCATION_EMOJI: Record<GatheringLocationType, string> = {
  PARK: "🌳",
  COMMUNITY_CENTER: "🏫",
  SCHOOL: "⛳",
};

/** ひらがな→カタカナ・英字→大文字に正規化（最大10文字） */
export function normalizeSecretWord(input: string): string {
  return input
    .trim()
    .slice(0, 10)
    .toUpperCase()
    .replace(/[ぁ-ゖ]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) + 0x60),
    );
}

// ─── スタンプ（エールを送る）機能 ─────────────────────────────────────────────

export type StampProgressStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

/** スタンプ受信側の当日進捗状態を判定。
 * done/total の定義は getProgressMilestones と同じ
 * （REPORTED + SKIP_REPORTED + APPROVED + SKIPPED の合計を done として渡す）。
 */
export function getStampProgressStatus(done: number, total: number): StampProgressStatus {
  if (total === 0 || done === 0) return "NOT_STARTED";
  if (done >= total) return "DONE";
  return "IN_PROGRESS";
}

/** スタンプ受信時の表示メッセージ。タスク名や数値は含めない（プライバシー方針）。 */
export function buildStampMessage(senderName: string, status: StampProgressStatus): string {
  switch (status) {
    case "NOT_STARTED":
      return `${senderName}からエール！スタートのきっかけにしよう！`;
    case "IN_PROGRESS":
      return `${senderName}からエール！その調子、いっしょに頑張ろう！`;
    case "DONE":
      return `${senderName}からエール！今日のがんばり、最高だね！`;
  }
}
