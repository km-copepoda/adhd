-- #187: TreasureLog 部分ユニークインデックスを (childId, date, バケット) に作り替える
--
-- 20261022000001 は適用済みの環境 (Vercel Preview の共有 DB) があり、
-- 適用済みマイグレーションを編集しても Prisma は再実行しないため、
-- 区分化の変更は履歴を書き換えず、このマイグレーションで追加する。
--
-- STREAK と PROXY は互いに代替枠 (どちらかがあればもう一方は作らない) なので同じバケットにまとめる。
-- (enum の text キャストは immutable でないため、比較のみの CASE 式でバケット化している)
--   バケット 1: ALL_COMPLETE / バケット 0: それ以外 (STREAK, PROXY)
--
-- 何度流しても、旧インデックスが有る/無い DB のどちらでも安全に動く。
-- 順序: 重複解消 -> 旧インデックス削除 -> 新インデックス作成
--
-- 1. 重複解消: 同一 (childId, date, バケット) の非 CANCELLED 行が複数あれば 1 件だけ残し、残りを CANCELLED にする。
-- 残す行の優先順位:
--   1. status が OPENED (報酬付与済みの履歴を消さない) > UNLOCKED > LOCKED
--   2. 同順位なら createdAt が古い方、さらに同じなら id の昇順
-- 行は削除せず status 更新のみ (巻き戻し可能)。
UPDATE "TreasureLog" AS t
SET "status" = 'CANCELLED'
FROM (
  SELECT "id",
         ROW_NUMBER() OVER (
           PARTITION BY "childId", "date", CASE WHEN "trigger" = 'ALL_COMPLETE' THEN 1 ELSE 0 END
           ORDER BY
             CASE "status"
               WHEN 'OPENED' THEN 0
               WHEN 'UNLOCKED' THEN 1
               ELSE 2
             END,
             "createdAt" ASC,
             "id" ASC
         ) AS rn
  FROM "TreasureLog"
  WHERE "status" <> 'CANCELLED'
) AS ranked
WHERE t."id" = ranked."id"
  AND ranked.rn > 1;

-- 2. 旧インデックス (生の trigger を使う版) を削除
DROP INDEX IF EXISTS "TreasureLog_childId_date_trigger_active_key";

-- 3. 区分化したインデックスを作成 (旧インデックス削除後なので同名で作れる)
CREATE UNIQUE INDEX IF NOT EXISTS "TreasureLog_childId_date_trigger_active_key"
  ON "TreasureLog" ("childId", "date", (CASE WHEN "trigger" = 'ALL_COMPLETE' THEN 1 ELSE 0 END))
  WHERE "status" <> 'CANCELLED';
