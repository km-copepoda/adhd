import { getCollectionItemById, SEASON_LABEL } from "@/lib/collectionItems";
import type { CollectionRarity } from "@/lib/collectionItems";

export type GatheringLocationType = "PARK" | "COMMUNITY_CENTER" | "SCHOOL";

const COLLECTION_RARITY_STARS: Record<CollectionRarity, string> = {
  COMMON: "★",
  UNCOMMON: "★★",
  RARE: "★★★",
};

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
    case "STAMP_SENT":
      return `${childName}がみんなにエールを送ったよ！`;
    case "COLLECTION_ITEM_OBTAINED": {
      // extra = collection item id (例 "summer-01"); 不正なら空文字列で書き込みスキップ
      if (!extra) return "";
      const item = getCollectionItemById(extra);
      if (!item) return "";
      const season = SEASON_LABEL[item.season];
      const stars = COLLECTION_RARITY_STARS[item.rarity];
      return `${childName}は${season}の${stars}コレクション「${item.name}」を手に入れた！`;
    }
    default:
      return "";
  }
}

export type BulletinLogType = "TASK_STARTED" | "TASK_PROGRESS_25" | "TASK_PROGRESS_50" | "TASK_PROGRESS_75" | "TASK_COMPLETE" | "BADGE_UNLOCKED" | "STREAK_TITLE" | "MONSTER_EVOLVED" | "MONSTER_REBORN" | "STAMP_SENT" | "COLLECTION_ITEM_OBTAINED";

/** 掲示板ログ種別ごとの絵文字（ADHD向け視覚的差別化） */
const BULLETIN_LOG_EMOJI: Record<string, string> = {
  TASK_STARTED: "🚀",
  TASK_PROGRESS_25: "🌱",
  TASK_PROGRESS_50: "💪",
  TASK_PROGRESS_75: "⚡",
  TASK_COMPLETE: "🎉",
  BADGE_UNLOCKED: "🏅",
  STREAK_TITLE: "👑",
  MONSTER_EVOLVED: "🌟",
  MONSTER_REBORN: "🐣",
  STAMP_SENT: "📣",
  COLLECTION_ITEM_OBTAINED: "🎴",
};

export function getBulletinLogEmoji(type: string): string {
  return BULLETIN_LOG_EMOJI[type] ?? "📢";
}

/** Date / ISO文字列を JST 基準の "YYYY-MM-DD" に正規化
 * BulletinLog.date は @db.Date（JST規約: JST日付を UTC 0:00 として保存）なので、
 * UTC 表現の年月日をそのまま取り出せば JST の日付となる
 */
function toJstDateStr(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export type BulletinLogGroup<T> = { dateStr: string; logs: T[] };

/** 掲示板ログを date でグループ化（日付降順、各グループ内は入力順を維持） */
export function groupBulletinLogsByDate<T extends { date: string | Date }>(
  logs: T[],
): BulletinLogGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const log of logs) {
    const key = toJstDateStr(log.date);
    const arr = map.get(key);
    if (arr) arr.push(log);
    else map.set(key, [log]);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => (a > b ? -1 : a < b ? 1 : 0))
    .map(([dateStr, logs]) => ({ dateStr, logs }));
}

/** "YYYY-MM-DD" を「M/D（曜）の掲示板」に整形（掲示板カードの見出し用） */
const WEEKDAY_LABEL = ["日", "月", "火", "水", "木", "金", "土"];
export function formatBulletinDateHeading(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const wd = WEEKDAY_LABEL[date.getUTCDay()];
  return `${m}/${d}（${wd}）の掲示板`;
}

type CoalesceLogLike = {
  childId: string;
  type: string;
  date: string | Date;
  createdAt: string | Date;
};

const TASK_PROGRESS_TYPES = new Set([
  "TASK_STARTED",
  "TASK_PROGRESS_25",
  "TASK_PROGRESS_50",
  "TASK_PROGRESS_75",
  "TASK_COMPLETE",
]);

/**
 * 同じ子供・同じ日の TASK_*（START/PROGRESS_25/50/75/COMPLETE）は最新1件のみ残す。
 * 入力は API レスポンスと同じ「date desc, createdAt desc」順を仮定し、最初に出現した1件を採用。
 * 非 TASK_* ログ（バッジ・進化・転生・称号）はそのまま素通しする。
 */
export function coalesceTaskProgress<T extends CoalesceLogLike>(logs: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const log of logs) {
    if (!TASK_PROGRESS_TYPES.has(log.type)) {
      out.push(log);
      continue;
    }
    const key = `${log.childId}__${toJstDateStr(log.date)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(log);
  }
  return out;
}

export type CondensedLogEntry<T> = {
  /** 束ねたグループの代表（最新ログ） */
  primary: T;
  /** 束ねた要素一覧（最新→古い順、primary を含む。単発なら長さ1） */
  items: T[];
};

const DEFAULT_BURST_WINDOW_MS = 5 * 60 * 1000;

/**
 * 同じ (childId, type) のログが時間窓内に連続している場合に1エントリへ束ねる。
 * - 入力は時系列降順（新しい順）を仮定。出力も降順を維持
 * - 隣接要素間の差分（最新からの相対距離ではない）で判定
 * - 単発ログも items.length===1 の CondensedLogEntry にラップして統一フォーマットで返す
 */
export function coalesceBurst<T extends CoalesceLogLike>(
  logs: T[],
  windowMs: number = DEFAULT_BURST_WINDOW_MS,
): CondensedLogEntry<T>[] {
  const out: CondensedLogEntry<T>[] = [];
  for (const log of logs) {
    const last = out[out.length - 1];
    if (
      last &&
      last.primary.childId === log.childId &&
      last.primary.type === log.type
    ) {
      const tail = last.items[last.items.length - 1];
      const diff =
        new Date(tail.createdAt).getTime() - new Date(log.createdAt).getTime();
      if (diff >= 0 && diff <= windowMs) {
        last.items.push(log);
        continue;
      }
    }
    out.push({ primary: log, items: [log] });
  }
  return out;
}

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
