// 「開かずの宝箱」救済のDB操作層（Issue #109）。
// 判定ロジック（純粋関数）は src/lib/orphanTreasure.ts に分離してある。
//
// 呼び出し元: scripts/rescue-orphan-treasures.ts（ワンショット復旧CLI）。
// 本番DBへの適用（dryRun: false）は人間の確認を経て手動実行することを前提とする。

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { todayJST } from "@/lib/date";
import { classifyOrphanTreasure } from "@/lib/orphanTreasure";

export interface RescueOrphanTreasuresInput {
  /** true ならDB更新を行わず分類結果のみ返す */
  dryRun: boolean;
  /** 指定時は当該 childId の宝箱のみ対象にする */
  childId?: string;
  /** 対象とする date の上限（この日付未満のLOCKEDが対象）。省略時は todayJST() */
  before?: Date;
  /** 候補件数の上限 */
  limit?: number;
  /**
   * #129 finding 3: 決定的カーソル。指定した TreasureLog.id より後ろ（id 昇順）から取得する。
   * SKIP 判定で LOCKED のまま残る行が limited バッチを占有し続ける問題を、
   * 監査ログに載った id を渡して次バッチへ進めることで回避する。
   */
  after?: string;
  /**
   * #129 finding 2: 分類完了後・DB書き込み前に一度だけ呼ばれる。
   * 監査ログを「適用前」に永続化するために使う（apply が途中で失敗しても計画が残る）。
   */
  onPlan?: (plan: RescueOrphanTreasuresResult) => void | Promise<void>;
}

export interface RescuedTreasureRecord {
  id: string;
  childId: string;
  date: Date;
  reason: string;
}

export interface RescueOrphanTreasuresResult {
  unlocked: RescuedTreasureRecord[];
  cancelled: RescuedTreasureRecord[];
  skipped: RescuedTreasureRecord[];
}

/**
 * status: "LOCKED" かつ date < before(既定 todayJST()) の TreasureLog を候補として取得し、
 * 同一 childId の QuestInstance（template.carryOver 込み）を参照して classifyOrphanTreasure で
 * UNLOCK / CANCEL / SKIP に分類する。
 *
 * 候補取得は常に id 昇順（決定的）。`after` でカーソル、`limit` で件数上限を指定できる。
 *
 * dryRun === false のときのみ、UNLOCK群・CANCEL群を **1つの $transaction** で更新する
 * （#129 finding 2: 片方だけ成功して本番DBが中途半端になる状態を防ぐ）。
 * 更新は必ず where に status: "LOCKED" を含める（TOCTOU対策。他プロセスが既に処理済みなら
 * ヒットしないため二重更新を防げる）。
 * onPlan を渡すと、書き込み直前に分類結果を受け取れる（監査ログの事前永続化用）。
 */
export async function rescueOrphanTreasures(
  input: RescueOrphanTreasuresInput,
): Promise<RescueOrphanTreasuresResult> {
  const { dryRun, childId, before, limit, after } = input;
  const today = before ?? todayJST();

  const where: { status: "LOCKED"; date: { lt: Date }; childId?: string } = {
    status: "LOCKED",
    date: { lt: today },
  };
  if (childId) where.childId = childId;

  const findArgs: {
    where: typeof where;
    orderBy: { id: "asc" };
    take?: number;
    cursor?: { id: string };
    skip?: number;
  } = { where, orderBy: { id: "asc" } };
  if (limit !== undefined) findArgs.take = limit;
  if (after !== undefined) {
    findArgs.cursor = { id: after };
    findArgs.skip = 1;
  }

  const candidates = await prisma.treasureLog.findMany(findArgs);

  const unlocked: RescuedTreasureRecord[] = [];
  const cancelled: RescuedTreasureRecord[] = [];
  const skipped: RescuedTreasureRecord[] = [];

  if (candidates.length === 0) {
    return { unlocked, cancelled, skipped };
  }

  for (const candidate of candidates) {
    const quests = await prisma.questInstance.findMany({
      where: { childId: candidate.childId },
      include: { template: true },
    });

    const classification = classifyOrphanTreasure({
      treasureDate: candidate.date,
      treasureStatus: candidate.status,
      today,
      quests: quests.map((q) => ({
        date: q.date,
        status: q.status,
        reportedAt: q.reportedAt,
        carryOver: q.template.carryOver,
      })),
    });

    const record: RescuedTreasureRecord = {
      id: candidate.id,
      childId: candidate.childId,
      date: candidate.date,
      reason: classification.reason,
    };

    if (classification.action === "UNLOCK") unlocked.push(record);
    else if (classification.action === "CANCEL") cancelled.push(record);
    else skipped.push(record);
  }

  const plan: RescueOrphanTreasuresResult = { unlocked, cancelled, skipped };

  if (!dryRun) {
    if (input.onPlan) await input.onPlan(plan);

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    if (unlocked.length > 0) {
      ops.push(
        prisma.treasureLog.updateMany({
          where: { id: { in: unlocked.map((u) => u.id) }, status: "LOCKED" },
          data: { status: "UNLOCKED" },
        }),
      );
    }
    if (cancelled.length > 0) {
      ops.push(
        prisma.treasureLog.updateMany({
          where: { id: { in: cancelled.map((c) => c.id) }, status: "LOCKED" },
          data: { status: "CANCELLED" },
        }),
      );
    }
    if (ops.length > 0) {
      await prisma.$transaction(ops);
    }
  }

  return plan;
}
