-- Add gathering feature: place + secret-word grouping with auto-logged bulletin board

-- Enums
CREATE TYPE "GatheringLocationType" AS ENUM ('PARK', 'COMMUNITY_CENTER', 'SCHOOL');

CREATE TYPE "BulletinLogType" AS ENUM (
  'TASK_STARTED',
  'TASK_PROGRESS_25',
  'TASK_PROGRESS_50',
  'TASK_PROGRESS_75',
  'TASK_COMPLETE',
  'BADGE_UNLOCKED',
  'STREAK_TITLE',
  'MONSTER_EVOLVED',
  'MONSTER_REBORN'
);

-- GatheringGroup
CREATE TABLE "GatheringGroup" (
  "id"         TEXT NOT NULL,
  "location"   "GatheringLocationType" NOT NULL,
  "secretWord" TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GatheringGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GatheringGroup_location_secretWord_key"
  ON "GatheringGroup"("location", "secretWord");

-- GatheringMember (1 child can be in at most 1 group at a time)
CREATE TABLE "GatheringMember" (
  "id"        TEXT NOT NULL,
  "groupId"   TEXT NOT NULL,
  "childId"   TEXT NOT NULL,
  "joinedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GatheringMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GatheringMember_childId_key" ON "GatheringMember"("childId");

ALTER TABLE "GatheringMember"
  ADD CONSTRAINT "GatheringMember_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "GatheringGroup"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GatheringMember"
  ADD CONSTRAINT "GatheringMember_childId_fkey"
  FOREIGN KEY ("childId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- BulletinLog (auto-written progress / badge / streak / evolution events)
CREATE TABLE "BulletinLog" (
  "id"         TEXT NOT NULL,
  "groupId"    TEXT NOT NULL,
  "childId"    TEXT NOT NULL,
  "type"       "BulletinLogType" NOT NULL,
  "message"    TEXT NOT NULL,
  "date"       DATE NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BulletinLog_pkey" PRIMARY KEY ("id")
);

-- 1ユーザは1日に同じ種別の掲示板ログを1件だけ持つ（同じバッジ・同じ進化は同日2回起きない想定）
CREATE UNIQUE INDEX "BulletinLog_groupId_childId_type_date_key"
  ON "BulletinLog"("groupId", "childId", "type", "date");

CREATE INDEX "BulletinLog_groupId_createdAt_idx"
  ON "BulletinLog"("groupId", "createdAt");

ALTER TABLE "BulletinLog"
  ADD CONSTRAINT "BulletinLog_groupId_fkey"
  FOREIGN KEY ("groupId") REFERENCES "GatheringGroup"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BulletinLog"
  ADD CONSTRAINT "BulletinLog_childId_fkey"
  FOREIGN KEY ("childId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Realtime: 子供画面・親画面とも掲示板の INSERT を購読する
ALTER PUBLICATION supabase_realtime ADD TABLE "BulletinLog";
