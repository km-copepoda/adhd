-- #184: 子どものログインを「家族コード + 4桁ユーザーコード」から、親が発行するワンタイムコードに置き換える。
-- 平文は保存せず sha256 のみ。Prisma（postgres ロール）経由でのみ読み書きするため、
-- RLS を有効化しポリシーは作らない（PostgREST の anon/authenticated から参照・更新できないようにする）。

-- CreateTable
CREATE TABLE "ChildLoginCode" (
    "childId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildLoginCode_pkey" PRIMARY KEY ("childId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChildLoginCode_codeHash_key" ON "ChildLoginCode"("codeHash");

-- AddForeignKey
ALTER TABLE "ChildLoginCode" ADD CONSTRAINT "ChildLoginCode_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChildLoginCode" ENABLE ROW LEVEL SECURITY;
