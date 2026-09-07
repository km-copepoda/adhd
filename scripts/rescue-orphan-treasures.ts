/**
 * 「開かずの宝箱」（LOCKEDのまま放置されたTreasureLog）を検出・救済するワンショット復旧CLI（Issue #109）。
 *
 * !!! 本番DBに対する実行（--apply）は、必ず出力内容と JSON 監査ログを人間が確認した上で
 * !!! 手動で行うこと。自動実行（cron等）には組み込まない。
 *
 * 判定ロジックは一切持たない。src/lib/orphanTreasure.ts（純粋関数）と
 * src/lib/orphanTreasureRescue.ts（DB操作）を呼び出すだけの薄いラッパー。
 *
 * 使い方:
 *   npm run rescue:treasures -- [--apply] [--child <childId>] [--before <YYYY-MM-DD>] [--limit <n>] [--after <id>]
 *
 * オプション:
 *   --dry-run       実際には書き込まず判定結果のみ表示する（既定動作）
 *   --apply         実際に DB を更新する（明示指定時のみ）
 *   --child <id>    対象を特定の childId に絞り込む
 *   --before <date> この日付未満の date を対象にする（省略時は todayJST()）
 *   --limit <n>     候補件数の上限
 *   --after <id>    この TreasureLog.id より後ろ（id 昇順）から取得する決定的カーソル。
 *                   SKIP 行が limited バッチを占有し続ける場合、監査ログの id を渡して次バッチへ進む。
 *
 * 監査ログ: --apply 時は DB 書き込みの **前** に書き出す（適用が途中で失敗しても計画が残る）。
 */

import { writeFileSync } from "node:fs";
import {
  rescueOrphanTreasures,
  type RescueOrphanTreasuresResult,
} from "@/lib/orphanTreasureRescue";

interface CliOptions {
  dryRun: boolean;
  childId?: string;
  before?: Date;
  limit?: number;
  after?: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: true };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--apply":
        options.dryRun = false;
        break;
      case "--child":
        options.childId = argv[++i];
        break;
      case "--before":
        options.before = new Date(`${argv[++i]}T00:00:00.000Z`);
        break;
      case "--limit":
        options.limit = Number(argv[++i]);
        break;
      case "--after":
        options.after = argv[++i];
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }

  return options;
}

/** 分類結果を JSON 監査ログとして書き出す。applied=false は「適用前の計画」を意味する。 */
function writeAudit(result: RescueOrphanTreasuresResult, applied: boolean): void {
  const auditRecords = [
    ...result.unlocked.map((r) => ({
      id: r.id,
      childId: r.childId,
      date: r.date.toISOString(),
      from: "LOCKED" as const,
      to: "UNLOCKED" as const,
      reason: r.reason,
    })),
    ...result.cancelled.map((r) => ({
      id: r.id,
      childId: r.childId,
      date: r.date.toISOString(),
      from: "LOCKED" as const,
      to: "CANCELLED" as const,
      reason: r.reason,
    })),
    ...result.skipped.map((r) => ({
      id: r.id,
      childId: r.childId,
      date: r.date.toISOString(),
      from: "LOCKED" as const,
      to: "LOCKED" as const,
      reason: r.reason,
    })),
  ];

  const suffix = applied ? "applied" : "plan";
  const auditPath = `rescue-orphan-treasures-${suffix}-${new Date()
    .toISOString()
    .replace(/[:.]/g, "-")}.json`;
  writeFileSync(
    auditPath,
    JSON.stringify({ applied, records: auditRecords }, null, 2),
    "utf-8",
  );
  console.log(
    `監査ログを書き出しました（${applied ? "適用済み" : "適用前の計画"}）: ${auditPath}`,
  );
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log(
    `[rescue-orphan-treasures] mode=${options.dryRun ? "DRY-RUN" : "APPLY"} ` +
      `childId=${options.childId ?? "(all)"} before=${options.before?.toISOString() ?? "(todayJST)"} ` +
      `limit=${options.limit ?? "(none)"} after=${options.after ?? "(none)"}`,
  );

  // --apply 時は書き込み前に onPlan で監査ログを永続化する。
  const result = await rescueOrphanTreasures({
    ...options,
    onPlan: options.dryRun ? undefined : (plan) => writeAudit(plan, false),
  });

  const skipReasonCounts = new Map<string, number>();
  let unresolvedCount = 0;
  let carryOverAmbiguousCount = 0;
  for (const s of result.skipped) {
    skipReasonCounts.set(s.reason, (skipReasonCounts.get(s.reason) ?? 0) + 1);
    if (s.reason.includes("UNRESOLVED")) unresolvedCount++;
    if (s.reason.includes("CARRYOVER_AMBIGUOUS")) carryOverAmbiguousCount++;
  }

  const total = result.unlocked.length + result.cancelled.length + result.skipped.length;
  console.log(`対象件数: ${total}`);
  console.log(`  UNLOCK: ${result.unlocked.length}`);
  console.log(`  CANCEL: ${result.cancelled.length}`);
  console.log(
    `  SKIP  : ${result.skipped.length}` +
      `（うち UNRESOLVED: ${unresolvedCount} / CARRYOVER_AMBIGUOUS: ${carryOverAmbiguousCount}）`,
  );
  for (const [reason, count] of skipReasonCounts) {
    console.log(`    - ${count}件: ${reason}`);
  }

  if (options.dryRun) {
    writeAudit(result, false);
    console.log("DRY-RUN のためDBは更新していません。--apply を付けて再実行すると反映されます。");
  } else {
    writeAudit(result, true);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
