-- チェックインカレンダー機能のスキーマ追加
-- 2026-06-24 の feat(checkin) コミット 9e4c0df で schema.prisma を変更したが
-- マイグレーションファイル作成漏れだったため後追いで追加する。
-- これが無いと Prisma client が新カラムを SELECT した瞬間に
-- "column does not exist" エラーを投げて全 API が 500 になる。

-- User: 親が設定するチェックイン締切時刻（null なら機能オフ扱い）
ALTER TABLE "User" ADD COLUMN "checkinDeadlineTime" TEXT;

-- Streak: チェックイン連続日数の集計フィールド
ALTER TABLE "Streak" ADD COLUMN "checkinCurrentStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Streak" ADD COLUMN "checkinBestStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Streak" ADD COLUMN "lastCheckinDate" DATE;

-- CheckinLog: 1日1レコードでチェックイン結果を記録
CREATE TABLE "CheckinLog" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "success" BOOLEAN NOT NULL,
    "checkedInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckinLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CheckinLog_childId_date_key" ON "CheckinLog"("childId", "date");
CREATE INDEX "CheckinLog_childId_idx" ON "CheckinLog"("childId");

ALTER TABLE "CheckinLog" ADD CONSTRAINT "CheckinLog_childId_fkey"
    FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
