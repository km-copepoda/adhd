-- 宝箱で新規コレクションアイテムを獲得したときの掲示板通知用に
-- enum 値を追加。
-- 関連: 2026-05-31「コレクションアイテム獲得をひろば通知」decisions.md
ALTER TYPE "BulletinLogType" ADD VALUE 'COLLECTION_ITEM_OBTAINED';
