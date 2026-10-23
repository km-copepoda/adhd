-- CreateTable
CREATE TABLE "AccountCleanupJob" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountCleanupJob_pkey" PRIMARY KEY ("id")
);

-- #235: 新規テーブルは RLS を有効化する（ポリシーは作らない。アクセスは Prisma のみ）
ALTER TABLE "AccountCleanupJob" ENABLE ROW LEVEL SECURITY;
