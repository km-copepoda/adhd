-- 一日休み券機能廃止: restPassUsedAt カラムを削除
ALTER TABLE "Streak" DROP COLUMN IF EXISTS "restPassUsedAt";
