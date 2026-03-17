-- Drop legacy TaskStreak table that was created before the Streak model was renamed.
-- New streak data is stored in the "Streak" table managed by Prisma.
DROP TABLE IF EXISTS "TaskStreak";
