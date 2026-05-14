-- 子供単位の「クエストタイム自動通知 ON/OFF」フラグ。
-- ADHD や不登校気味の子に対する過度な通知を親が止められるようにする安全弁。
-- 既存ユーザーは true（通知ON）でマイグレーションする。

ALTER TABLE "User"
  ADD COLUMN "questTimeNotifyEnabled" BOOLEAN NOT NULL DEFAULT true;
