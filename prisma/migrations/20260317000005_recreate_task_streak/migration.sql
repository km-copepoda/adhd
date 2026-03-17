-- drop_legacy_task_streakによって削除されたTaskStreakテーブルを再作成
CREATE TABLE IF NOT EXISTS "TaskStreak" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastAchievedDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskStreak_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TaskStreak_taskId_childId_key" ON "TaskStreak"("taskId", "childId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TaskStreak_taskId_fkey'
  ) THEN
    ALTER TABLE "TaskStreak" ADD CONSTRAINT "TaskStreak_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "TaskTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TaskStreak_childId_fkey'
  ) THEN
    ALTER TABLE "TaskStreak" ADD CONSTRAINT "TaskStreak_childId_fkey"
      FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
