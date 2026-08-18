-- Issue #73: モンスターテーマセット Stage1 — テーマ基盤スキーマ追加
-- User: 現在有効なテーマセット id (dark/light/buddha ...)。既存ユーザーは
-- side (DARK/LIGHT) から導出してバックフィルする。pendingMonsterSetId は
-- 進化演出中などに反映待ちのテーマ切替予約を保持する（未使用時は null）。
ALTER TABLE "User" ADD COLUMN "monsterSetId" TEXT NOT NULL DEFAULT 'dark';
ALTER TABLE "User" ADD COLUMN "pendingMonsterSetId" TEXT;

-- 既存レコードのバックフィル: side=LIGHT のユーザーだけ "light" にする。
-- それ以外 (DARK / null) はカラムのデフォルト値 'dark' のままでよい。
UPDATE "User" SET "monsterSetId" = 'light' WHERE "side" = 'LIGHT';

-- ChildMonsterTheme: 有料テーマの有効化・付与履歴（購入等）
CREATE TABLE "ChildMonsterTheme" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantReason" TEXT NOT NULL,

    CONSTRAINT "ChildMonsterTheme_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChildMonsterTheme_childId_themeId_key" ON "ChildMonsterTheme"("childId", "themeId");
CREATE INDEX "ChildMonsterTheme_childId_idx" ON "ChildMonsterTheme"("childId");

ALTER TABLE "ChildMonsterTheme" ADD CONSTRAINT "ChildMonsterTheme_childId_fkey"
    FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
