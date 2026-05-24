import { DECLARATION_BONUS_XP } from "@/lib/declaration";
import { jstDateOf } from "@/lib/date";

type Category = "STUDY" | "STAMINA" | "LIFE";

/**
 * クエストの XP を計算する。基本 1pt + 期限ボーナス + 写真ボーナス + 宣言ボーナス。
 * `declared` を渡さなければ宣言ボーナスは含まれない（後方互換）。
 */
export function calculateQuestXP(
  quest: {
    deadlineBonusEarned: boolean;
    photoUrl: string | null;
    template: { photoBonus: boolean };
  },
  declared = false,
): number {
  let xp = 1;
  if (quest.deadlineBonusEarned) xp++;
  if (quest.template.photoBonus && quest.photoUrl) xp++;
  if (declared) xp += DECLARATION_BONUS_XP;
  return xp;
}

/**
 * フラグだけ手元にあるケース（UI で `photoUrl` などのオブジェクトを持っていない場面）向けの薄いラッパ。
 * 内部で `calculateQuestXP` を呼ぶので XP ルールの単一情報源は常に `calculateQuestXP`。
 */
export function calcActualXP(
  deadlineBonusEarned: boolean,
  photoBonus: boolean,
  hasPhoto: boolean,
  declared = false,
): number {
  return calculateQuestXP(
    {
      deadlineBonusEarned,
      photoUrl: hasPhoto ? "x" : null,
      template: { photoBonus },
    },
    declared,
  );
}

/**
 * UI 表示用の XP レンジラベル。報告前に「これだけもらえる可能性がある」を子供に見せるための文字列。
 * 宣言ボーナスは宣言時点で確定するので min/max の両方に乗る。
 */
export function xpRangeLabel(hasDeadline: boolean, photoBonus: boolean, declared = false): string {
  const min = 1 + (declared ? 1 : 0);
  const max = min + (hasDeadline ? 1 : 0) + (photoBonus ? 1 : 0);
  return min === max ? `+${min}pt` : `+${min}〜${max}pt`;
}

type QuestForSum = {
  status: string;
  deadlineBonusEarned: boolean;
  photoUrl: string | null;
  declaredToday: boolean;
  template: { photoBonus: boolean };
};

/**
 * 指定ステータスのクエストの XP 合計を返す（仮ゲージ / 本ゲージ用）。
 */
export function sumQuestXp(quests: QuestForSum[], status: string): number {
  return quests
    .filter((q) => q.status === status)
    .reduce((sum, q) => sum + calculateQuestXP(q, q.declaredToday), 0);
}

type PendingQuest = {
  templateId: string;
  reportedAt: Date | null;
  deadlineBonusEarned: boolean;
  photoUrl: string | null;
  snapshotCategory: Category | string | null;
  template: { category: Category | string; photoBonus: boolean };
};

type DeclarationKey = { templateId: string; date: Date };

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * REPORTED クエストの仮 XP をカテゴリ別に集計する。
 * 「今日やる宣言ボーナス」(reportedAt の JST 日付と declarations の date が一致したら +1) を含む。
 * 育成画面の `(仮)` 表示と、クエスト画面のタイル個別 +xpXP が一致するように同じロジックを使う。
 */
export function pendingXpByCategory(
  quests: PendingQuest[],
  declarations: DeclarationKey[],
): { STUDY: number; STAMINA: number; LIFE: number } {
  const declSet = new Set(declarations.map((d) => `${d.templateId}|${dateKey(d.date)}`));
  const totals = { STUDY: 0, STAMINA: 0, LIFE: 0 } as { STUDY: number; STAMINA: number; LIFE: number };
  for (const q of quests) {
    const declared = q.reportedAt
      ? declSet.has(`${q.templateId}|${dateKey(jstDateOf(q.reportedAt))}`)
      : false;
    const xp = calculateQuestXP(q, declared);
    const cat = (q.snapshotCategory ?? q.template.category) as Category;
    if (cat === "STUDY" || cat === "STAMINA" || cat === "LIFE") {
      totals[cat] += xp;
    }
  }
  return totals;
}
