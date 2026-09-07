// 「開かずの宝箱」（status: "LOCKED" のまま date < todayJST() で放置された TreasureLog）を
// UNLOCK / CANCEL / SKIP に分類する純粋関数（Prisma 非依存、DB操作は orphanTreasureRescue.ts）。
//
// Issue #109: cron の日次処理は「今日」の宝箱しか見ないため、report/approve の実装バグや
// 手動DB操作等で LOCKED のまま取り残された過去の宝箱は自然には解消されない。
// 本モジュールは、対象日 D を実際に「支配」しているクエストの現在の状態を
// resolveTreasureDate（Issue #108, src/lib/treasureDate.ts）で再計算し、
// 承認済みなら UNLOCK、差し戻し確定なら CANCEL、判断がつかないものは SKIP して
// 人間の確認に委ねる。

import { resolveTreasureDate } from "@/lib/treasureDate";

export type OrphanTreasureAction = "UNLOCK" | "CANCEL" | "SKIP";

export type OrphanQuestStatus =
  | "PENDING"
  | "REPORTED"
  | "APPROVED"
  | "REJECTED"
  | "SKIPPED"
  | "SKIP_REPORTED";

export type OrphanTreasureStatus = "LOCKED" | "UNLOCKED" | "OPENED" | "CANCELLED";

export interface OrphanTreasureQuestInput {
  date: Date;
  status: OrphanQuestStatus;
  reportedAt: Date | null;
  carryOver: boolean;
}

export interface ClassifyOrphanTreasureInput {
  treasureDate: Date;
  treasureStatus: OrphanTreasureStatus;
  today: Date;
  quests: OrphanTreasureQuestInput[];
}

export interface OrphanTreasureClassification {
  action: OrphanTreasureAction;
  reason: string;
}

/**
 * 対象の TreasureLog（treasureDate/treasureStatus）と、同一 childId の QuestInstance 群から
 * 「開かずの宝箱」の救済アクションを判定する。
 *
 * 分類ルールの優先順位:
 *   0. treasureStatus !== "LOCKED" または treasureDate >= today → 無条件 SKIP（対象外・冪等）
 *   0.5. carryOver の値によって支配判定が変わりうるクエスト（報告日が quest.date を跨ぐもの）が
 *        この treasureDate に絡む → SKIP（CARRYOVER_AMBIGUOUS。生成時の値が復元不能なため #129 P1）
 *   1. resolveTreasureDate(quest.date, quest.carryOver, quest.reportedAt ?? quest.date) が
 *      treasureDate に一致するクエストを「支配クエスト」とする
 *   2. 支配クエストに REPORTED / SKIP_REPORTED が1件でも残る → SKIP
 *   3. quest.date === treasureDate の PENDING が1件でも残る → SKIP（APPROVED併存でも優先）
 *   4. 支配クエストに APPROVED または SKIPPED が1件以上 → UNLOCK
 *      （REJECTED が混在する場合は reason にその旨を明記）
 *   5. 支配クエストが1件以上あり全て REJECTED → CANCEL
 *   6. 支配クエストが0件 → SKIP（reason に UNRESOLVED を含む）
 */
export function classifyOrphanTreasure(
  input: ClassifyOrphanTreasureInput,
): OrphanTreasureClassification {
  const { treasureDate, treasureStatus, today, quests } = input;

  if (treasureStatus !== "LOCKED" || treasureDate.getTime() >= today.getTime()) {
    return {
      action: "SKIP",
      reason: "対象外（LOCKEDでない、または過去日ではない。冪等スキップ）",
    };
  }

  // #129 P1: 生成時の carryOver 値は復元できない（QuestInstance にスナップショットが無く、
  // 親が PUT /api/tasks/[id] で後から変更しうる）。carryOver を true/false のどちらと
  // 仮定するかで「支配クエスト」への出入りが変わるクエスト（＝報告日が quest.date より
  // 後の JST 暦日にずれているもの）が、この treasureDate に絡んでいる場合は、
  // どちらの仮定でも結論が同じにならない限り自動処理せず SKIP して人間に委ねる。
  const treasureTime = treasureDate.getTime();
  const carryOverAmbiguous = quests.some((q) => {
    const at = q.reportedAt ?? q.date;
    const asTrue = resolveTreasureDate(q.date, true, at).getTime();
    const asFalse = resolveTreasureDate(q.date, false, at).getTime();
    if (asTrue === asFalse) return false; // carryOver の値に依存しないクエスト
    const touchesThisTreasure = asTrue === treasureTime || asFalse === treasureTime;
    const affectsClassification =
      q.status === "REPORTED" ||
      q.status === "SKIP_REPORTED" ||
      q.status === "APPROVED" ||
      q.status === "SKIPPED" ||
      q.status === "REJECTED";
    return touchesThisTreasure && affectsClassification;
  });
  if (carryOverAmbiguous) {
    return {
      action: "SKIP",
      reason:
        "CARRYOVER_AMBIGUOUS: 報告日が quest.date を跨いでおり、生成時の carryOver 値を特定できない。" +
        "テンプレートが後から編集された可能性があるため人間による確認が必要",
    };
  }

  const dominating = quests.filter(
    (q) =>
      resolveTreasureDate(q.date, q.carryOver, q.reportedAt ?? q.date).getTime() ===
      treasureDate.getTime(),
  );

  if (dominating.some((q) => q.status === "REPORTED" || q.status === "SKIP_REPORTED")) {
    return {
      action: "SKIP",
      reason: "支配クエストに REPORTED / SKIP_REPORTED が残っているため保留",
    };
  }

  const hasPendingOnDate = quests.some(
    (q) => q.date.getTime() === treasureDate.getTime() && q.status === "PENDING",
  );
  if (hasPendingOnDate) {
    return {
      action: "SKIP",
      reason: "quest.date一致の PENDING が残っているため保留（APPROVED併存でもSKIP優先）",
    };
  }

  const approvedOrSkipped = dominating.filter(
    (q) => q.status === "APPROVED" || q.status === "SKIPPED",
  );
  const rejected = dominating.filter((q) => q.status === "REJECTED");

  if (approvedOrSkipped.length > 0) {
    if (rejected.length > 0) {
      return {
        action: "UNLOCK",
        reason: "支配クエストに APPROVED/SKIPPED と REJECTED が混在。承認済み分を優先しUNLOCK",
      };
    }
    return { action: "UNLOCK", reason: "支配クエストに APPROVED または SKIPPED があるためUNLOCK" };
  }

  if (dominating.length > 0 && dominating.every((q) => q.status === "REJECTED")) {
    return { action: "CANCEL", reason: "支配クエストが全て REJECTED のためCANCEL" };
  }

  return {
    action: "SKIP",
    reason: "支配クエストが見つからない（UNRESOLVED）。人間による確認が必要",
  };
}
