-- 「渡したよ」フロー廃止に伴う TreasureLog.fulfilled の削除
-- 設計変更: 2026-05-28 (decisions.md 参照)
-- 親は履歴を見るだけで「渡したよ」確定操作は廃止。
-- 実際の受け渡しは親子のリアルなコミュニケーションに任せる方針。

ALTER TABLE "TreasureLog" DROP COLUMN "fulfilled";
