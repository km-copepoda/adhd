-- Add pausedAt to TaskTemplate for parent-controlled pause/resume of child tasks
-- Non-null = paused: task is hidden from child screen and no new QuestInstance is generated.
-- Preserves repeatDays / targetDate so resume brings the task back with the same schedule.

ALTER TABLE "TaskTemplate" ADD COLUMN "pausedAt" TIMESTAMP(3);
