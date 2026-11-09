import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { cleanupExternal } from "@/lib/accountCleanup";
import type { ExternalCleanup } from "@/lib/accountDeletion.data";

// 外部削除 outbox（AccountCleanupJob）の実行。例外は投げず、失敗は次回の cron で再試行する。

const ALERT_ATTEMPTS = 10;

export async function runAccountCleanupJob(jobId: string): Promise<void> {
  try {
    const job = await prisma.accountCleanupJob.findUnique({ where: { id: jobId } });
    if (!job) return;

    const remaining = await cleanupExternal(job.payload as unknown as ExternalCleanup);
    if (remaining.supabaseIds.length + remaining.childIds.length + remaining.photoPaths.length === 0) {
      await prisma.accountCleanupJob.delete({ where: { id: jobId } });
      return;
    }

    const attempts = job.attempts + 1;
    await prisma.accountCleanupJob.update({
      where: { id: jobId },
      data: {
        payload: remaining as unknown as object,
        attempts,
        lastError: `incomplete: auth=${remaining.supabaseIds.length} children=${remaining.childIds.length} photos=${remaining.photoPaths.length}`,
      },
    });
    if (attempts >= ALERT_ATTEMPTS) {
      log.error("account cleanup job keeps failing", { jobId, attempts, familyId: remaining.familyId ?? undefined });
    }
  } catch (e) {
    log.error("account cleanup job crashed", { jobId, error: e instanceof Error ? e.message : String(e) });
  }
}

/** 未完了ジョブを古い順に処理し、処理した件数を返す */
export async function runPendingAccountCleanupJobs(limit = 50): Promise<number> {
  const jobs = await prisma.accountCleanupJob.findMany({ orderBy: { updatedAt: "asc" }, take: limit });
  for (const job of jobs) await runAccountCleanupJob(job.id);
  return jobs.length;
}
