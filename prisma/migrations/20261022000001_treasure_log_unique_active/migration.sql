-- #187: 宝箱 (TreasureLog) の二重生成を DB 側で防ぐ部分ユニークインデックス
--
-- 同日の宝箱は CANCELLED を除いて、STREAK/PROXY 枠で 1 件、ALL_COMPLETE 枠で 1 件まで。
-- STREAK と PROXY は互いに代替枠 (どちらかがあればもう一方は作らない) なので同じバケットにまとめる。
-- (enum の text キャストは immutable でないため、比較のみの CASE 式でバケット化している)
-- 「存在確認 -> 作成」の競合 (同日 report の連打 / report と親代理 report-approve の競合) で
-- STREAK / ALL_COMPLETE / PROXY が 2 行できるのを防ぐ。
-- アプリ側 (treasureService.createTreasureIdempotent) は一意制約違反 (P2002) を握りつぶして冪等にする。
--
-- Prisma schema は WHERE 付きの部分ユニークインデックスを表現できないため、
-- schema.prisma には書けず、この raw SQL マイグレーションだけで管理する。
-- `prisma migrate dev` の drift 検知対象外のインデックスなので消さないこと。
--
-- 既存データに重複行がある可能性があるため、先に重複を解消してからインデックスを作る。
-- 同一 (childId, date, バケット) の非 CANCELLED 行が複数あれば 1 件だけ残し、残りを CANCELLED にする。
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

CREATE UNIQUE INDEX IF NOT EXISTS "TreasureLog_childId_date_trigger_active_key"
  ON "TreasureLog" ("childId", "date", (CASE WHEN "trigger" = 'ALL_COMPLETE' THEN 1 ELSE 0 END))
  WHERE "status" <> 'CANCELLED';
