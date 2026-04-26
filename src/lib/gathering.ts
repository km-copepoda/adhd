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
    .replace(/[\u3041-\u3096]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) + 0x60),
    );
}

/** 掲示板ログのメッセージを生成 */
export function buildBulletinMessage(
  type: string,
  childName: string,
  extra?: string,
): string {
  switch (type) {
    case "TASK_STARTED":
      return `${childName}が今日のクエストをスタートした！`;
    case "TASK_PROGRESS_25":
      return `${childName}はクエストを頑張っている！`;
    case "TASK_PROGRESS_50":
      return `${childName}は夢中でクエストをこなしている！`;
    case "TASK_PROGRESS_75":
      return `${childName}のクエストはもうすぐ全部終わりそうだ！`;
    case "TASK_COMPLETE":
      return `${childName}は今日のクエストをすべてやりとげた！`;
    case "BADGE_UNLOCKED":
      return `${childName}は新しいバッジ「${extra}」を手に入れた！`;
    case "STREAK_TITLE":
      return `${childName}は新しい称号「${extra}」を手に入れた！`;
    case "MONSTER_EVOLVED":
      return `${childName}のモンスターが${extra}に進化した！`;
    case "MONSTER_REBORN":
      return `${childName}のモンスターが転生して${extra}の卵になった！`;
    default:
      return "";
  }
}

export type BulletinLogType = "TASK_STARTED" | "TASK_PROGRESS_25" | "TASK_PROGRESS_50" | "TASK_PROGRESS_75" | "TASK_COMPLETE" | "BADGE_UNLOCKED" | "STREAK_TITLE" | "MONSTER_EVOLVED" | "MONSTER_REBORN";

/** タスク進捗のマイルストーン判定（達成したtype一覧を返す） */
export function getProgressMilestones(
  done: number,
  total: number,
): Array<"TASK_STARTED" | "TASK_PROGRESS_25" | "TASK_PROGRESS_50" | "TASK_PROGRESS_75" | "TASK_COMPLETE"> {
  if (total === 0 || done === 0) return [];
  const pct = (done / total) * 100;
  const milestones: Array<"TASK_STARTED" | "TASK_PROGRESS_25" | "TASK_PROGRESS_50" | "TASK_PROGRESS_75" | "TASK_COMPLETE"> = [];
  if (done >= 1) milestones.push("TASK_STARTED");
  if (pct >= 25) milestones.push("TASK_PROGRESS_25");
  if (pct >= 50) milestones.push("TASK_PROGRESS_50");
  if (pct >= 75) milestones.push("TASK_PROGRESS_75");
  if (pct >= 100) milestones.push("TASK_COMPLETE");
  return milestones;
}
