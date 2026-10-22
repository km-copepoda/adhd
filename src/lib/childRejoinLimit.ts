import { prisma } from "@/lib/prisma";

// child-rejoin の総当たり対策（#184）。失敗回数を DB に保持してサーバレスのインスタンス間で共有する。
//
// - ユーザー単位（匿名セッションの supabaseUserId）: 少ない回数でロック
// - ファミリーコード単位: 匿名セッションを作り直されても止められるよう、全セッション合算で数える。
//   正規ユーザーの巻き込みを避けるため上限は緩め。成功してもリセットしない
//   （自家族のコードを知る攻撃者が成功でリセットして兄弟分を総当たりするのを防ぐ）。

export const USER_MAX_FAILURES = 5;
export const FAMILY_MAX_FAILURES = 20;
export const LOCK_MS = 15 * 60 * 1000;
/** 最後の失敗からこの時間が経つとカウントを数え直す */
export const WINDOW_MS = 15 * 60 * 1000;

export const userKey = (supabaseUserId: string) => `user:${supabaseUserId}`;
export const familyKey = (familyCode: string) => `family:${familyCode}`;

export async function isLocked(key: string, now: Date = new Date()): Promise<boolean> {
  const row = await prisma.childRejoinAttempt.findUnique({ where: { key } });
  return !!row?.lockedUntil && row.lockedUntil.getTime() > now.getTime();
}

export async function recordFailure(
  key: string,
  maxFailures: number,
  now: Date = new Date(),
): Promise<void> {
  const row = await prisma.childRejoinAttempt.findUnique({ where: { key } });
  const lockExpired = !!row?.lockedUntil && row.lockedUntil.getTime() <= now.getTime();
  const windowExpired = !!row && now.getTime() - row.updatedAt.getTime() > WINDOW_MS;
  const failCount = !row || lockExpired || windowExpired ? 1 : row.failCount + 1;
  const lockedUntil = failCount >= maxFailures ? new Date(now.getTime() + LOCK_MS) : null;
  await prisma.childRejoinAttempt.upsert({
    where: { key },
    create: { key, failCount, lockedUntil },
    update: { failCount, lockedUntil },
  });
}

export async function resetAttempts(key: string): Promise<void> {
  await prisma.childRejoinAttempt.deleteMany({ where: { key } });
}
