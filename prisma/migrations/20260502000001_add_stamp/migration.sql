-- Stamp model: グループ参加中の子供が「エールを送る」ために
-- 1日1回 INSERT するレコード。受信ログは残さず、Realtime + Push でその場限りの通知。

CREATE TABLE "Stamp" (
  "id"        TEXT NOT NULL,
  "groupId"   TEXT NOT NULL,
  "senderId"  TEXT NOT NULL,
  "date"      DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Stamp_pkey" PRIMARY KEY ("id")
);

-- 1日1回制約
CREATE UNIQUE INDEX "Stamp_senderId_date_key"
  ON "Stamp"("senderId", "date");

CREATE INDEX "Stamp_groupId_createdAt_idx"
  ON "Stamp"("groupId", "createdAt");

ALTER TABLE "Stamp"
  ADD CONSTRAINT "Stamp_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "GatheringGroup"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Stamp"
  ADD CONSTRAINT "Stamp_senderId_fkey"
  FOREIGN KEY ("senderId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Realtime 配信のため publication に追加
ALTER PUBLICATION supabase_realtime ADD TABLE "Stamp";
