-- Add pauseIntervals to TaskTemplate: JSON array of past pause periods {start, end} in ISO strings.
-- Currently-paused period is tracked by pausedAt only; on resume, {start:pausedAt, end:now} is appended here.
-- Used by parent "N回未完了" badge to freeze during pause and subtract past pause windows after resume.

ALTER TABLE "TaskTemplate" ADD COLUMN "pauseIntervals" JSONB NOT NULL DEFAULT '[]';
