-- #184: child-rejoin の総当たり対策として失敗回数とロック期限を保持する。
-- Prisma（postgres ロール）経由でのみ読み書きするため、RLS を有効化しポリシーは作らない
-- （PostgREST の anon/authenticated から参照・更新できないようにする）。

-- CreateTable
CREATE TABLE "ChildRejoinAttempt" (
    "key" TEXT NOT NULL,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildRejoinAttempt_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "ChildRejoinAttempt" ENABLE ROW LEVEL SECURITY;

-- 期限切れ行の掃除（updatedAt での範囲削除）用
-- CreateIndex
CREATE INDEX "ChildRejoinAttempt_updatedAt_idx" ON "ChildRejoinAttempt"("updatedAt");
