-- Add carryOver flag to TaskTemplate
-- When enabled, a task that the child forgot (PENDING, not reported) will carry over
-- to the next day instead of being silently dropped.

ALTER TABLE "TaskTemplate" ADD COLUMN "carryOver" BOOLEAN NOT NULL DEFAULT false;
