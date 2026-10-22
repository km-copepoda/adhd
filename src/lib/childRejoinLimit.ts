import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// child-rejoin の総当たり対策（#184）。試行回数を DB に保持してサーバレスのインスタンス間で共有する。
//
// - ファミリーコード単位（実効的な制限）: 全セッション合算で数える。試行の前に数え（成功も含む）、
//   成功してもリセットしない。並列の総当たりでも取りこぼさず、自家族のコードを知る攻撃者が
//   成功でリセットして兄弟分を総当たりするのも防ぐ。上限は正規ユーザーの巻き込みを避けるため緩め。
// - ユーザー単位（匿名セッションの supabaseUserId）: 失敗のみ数える補助的な制限。
//   子ども用ログイン画面は試行ごとに signOut + signInAnonymously で ID が変わるため、
//   画面経由の連続試行ではほぼ効かない（セッションを使い回すクライアントへの保険）。

export const USER_MAX_FAILURES = 5;
export const FAMILY_MAX_FAILURES = 20;
export const LOCK_MS = 15 * 60 * 1000;
/** 最後の試行からこの時間が経つとカウントを数え直す */
export const WINDOW_MS = 15 * 60 * 1000;

export const userKey = (supabaseUserId: string) => `user:${supabaseUserId}`;
export const familyKey = (familyCode: string) => `family:${familyCode}`;

export async function isLocked(key: string, now: Date = new Date()): Promise<boolean> {
  const row = await prisma.childRejoinAttempt.findUnique({ where: { key } });
  return !!row?.lockedUntil && row.lockedUntil.getTime() > now.getTime();
}

export type AttemptResult = { count: number; lockedUntil: Date | null; locked: boolean };

/**
 * 試行を 1 回数える。カウントとロック開始は 1 本の INSERT ... ON CONFLICT DO UPDATE で
 * 原子的に行い、並列リクエストでも取りこぼさない。拒否判定は戻り値（更新後の行）で行う。
 * - ロック期限切れ / 最終更新から WINDOW_MS 経過 → 1 から数え直す
 * - count >= maxFailures でロック開始（ロック中は lockedUntil を延長しない）
 * - locked: 更新後の count が maxFailures を超えた（= この試行は拒否すべき）
 */
export async function recordAttempt(
  key: string,
  maxFailures: number,
  now: Date = new Date(),
): Promise<AttemptResult> {
  const windowStart = new Date(now.getTime() - WINDOW_MS);
  const lockUntil = new Date(now.getTime() + LOCK_MS);
  const t = Prisma.raw('"ChildRejoinAttempt"');
  // 既存行が数え直し対象か（ロック期限切れ or ウィンドウ経過）
  const stale = Prisma.sql`(${t}."lockedUntil" <= ${now} OR ${t}."updatedAt" < ${windowStart})`;
  const nextCount = Prisma.sql`(CASE WHEN ${stale} THEN 1 ELSE ${t}."failCount" + 1 END)`;
  const rows = await prisma.$queryRaw<{ failCount: number; lockedUntil: Date | null }[]>`
    INSERT INTO "ChildRejoinAttempt" ("key", "failCount", "lockedUntil", "updatedAt")
    VALUES (${key}, 1, ${maxFailures <= 1 ? lockUntil : null}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "failCount" = ${nextCount},
      "lockedUntil" = CASE
        WHEN ${stale} THEN ${maxFailures <= 1 ? lockUntil : null}
        WHEN ${t}."lockedUntil" IS NOT NULL THEN ${t}."lockedUntil"
        WHEN ${nextCount} >= ${maxFailures} THEN ${lockUntil}
        ELSE NULL
      END,
      "updatedAt" = ${now}
    RETURNING "failCount", "lockedUntil"`;
  const row = rows[0];
  return {
    count: row.failCount,
    lockedUntil: row.lockedUntil,
    locked: row.failCount > maxFailures,
  };
}

/** 期限切れ（ロック解除済みかつウィンドウ経過）の行を削除する。テーブルが無制限に増えるのを防ぐ */
export async function purgeExpiredAttempts(now: Date = new Date()): Promise<void> {
  await prisma.childRejoinAttempt.deleteMany({
    where: {
      updatedAt: { lt: new Date(now.getTime() - WINDOW_MS) },
      OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
    },
  });
}

export async function resetAttempts(key: string): Promise<void> {
  await prisma.childRejoinAttempt.deleteMany({ where: { key } });
}
