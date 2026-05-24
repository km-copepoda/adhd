import { DECLARATION_BONUS_XP } from "@/lib/declaration";
import { jstDateOf } from "@/lib/date";

/**
 * クエストの XP を計算する。
 * 基本 1pt + 期限ボーナス + 写真ボーナス (最大 3pt)
 *
 * 注: 「今日やる宣言」ボーナスは含まない。
 * 宣言ボーナスは reportedAt の JST 日付と QuestDeclaration の照合が必要なので、
 * カテゴリ別集計には pendingXpByCategory を使うこと。
 */
export function calculateQuestXP(quest: {
  deadlineBonusEarned: boolean;
  photoUrl: string | null;
  template: { photoBonus: boolean };
}): number {
  let xp = 1;
  if (quest.deadlineBonusEarned) xp++;
  if (quest.template.photoBonus && quest.photoUrl) xp++;
  return xp;
}

type Category = "STUDY" | "STAMINA" | "LIFE";

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
    const xp = calculateQuestXP(q) + (declared ? DECLARATION_BONUS_XP : 0);
    const cat = (q.snapshotCategory ?? q.template.category) as Category;
    if (cat === "STUDY" || cat === "STAMINA" || cat === "LIFE") {
      totals[cat] += xp;
    }
  }
  return totals;
}
