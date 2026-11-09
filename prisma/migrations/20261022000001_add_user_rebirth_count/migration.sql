-- #192: 転生回数を DB のカウンタ列で持つ
--
-- 従来は badges.ts が floor((collectedPaths 件数 - 1) / 3) で推定していたが、
-- addCollectedPath は既出パスを追加しないため、同じ系統を繰り返すと過小に数えられていた。
--
-- バックフィル: 既存ユーザーの初期値は従来の推定式で埋める（取得済みバッジを失わせないため）。
ALTER TABLE "User" ADD COLUMN "rebirthCount" INTEGER NOT NULL DEFAULT 0;

UPDATE "User"
SET "rebirthCount" = GREATEST(0, FLOOR((jsonb_array_length("collectedPaths"::jsonb) - 1) / 3.0))::INTEGER
WHERE jsonb_typeof("collectedPaths"::jsonb) = 'array';
