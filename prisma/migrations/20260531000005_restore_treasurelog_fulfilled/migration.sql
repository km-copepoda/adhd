-- 親が「実物のごほうびを子供に渡したか」を記録するフラグを復活。
-- 2026-05-28 で削除したカラムを 2026-05-31 で再追加。
-- 子画面には露出させない（水掛け論防衛用の親メモ）。
-- 関連: decisions.md 2026-05-31「親メモとしてfulfilled復活」

ALTER TABLE "TreasureLog" ADD COLUMN "fulfilled" BOOLEAN NOT NULL DEFAULT false;
