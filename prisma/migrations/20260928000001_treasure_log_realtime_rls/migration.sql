-- PR #152 Codex指摘（P1）: TreasureLog の RLS が Realtime publication 追加に
-- 追従していなかった問題の修正。
--
-- 20260925000001_add_treasure_use_status で TreasureLog を
-- supabase_realtime publication に追加したが、RLS の有効化・ポリシー作成は
-- supabase/seed.sql にしかなく、`vercel.json` の buildCommand
--   prisma migrate deploy && prisma db execute --file supabase/seed.sql
-- の順で実行されるため、migrate deploy が完了してから seed.sql が走るまでの
-- 間、publication には登録済みだが RLS 未有効という窓ができていた。
-- この窓では認証済みクライアントが postgres_changes 経由で他家庭の
-- TreasureLog 更新を受信できてしまう。
--
-- 20260925000001 は既に一部環境（PRプレビュー等の共有 Supabase DB）へ
-- 適用済み・Prisma のマイグレーションチェックサムが記録済みのため、
-- そのファイル自体は書き換えず、この新しいマイグレーションで RLS を
-- 有効化する。同一 `prisma migrate deploy` 実行内で直後に流れるため、
-- 本番デプロイでは publication 追加から RLS 有効化までの窓を実質的に
-- 閉じられる（ビルド・アプリ起動前に完結するため）。

-- get_my_user_id() / is_same_family() は supabase/seed.sql で
-- CREATE OR REPLACE FUNCTION 済みだが、seed.sql をまだ一度も実行していない
-- 新規環境（プレビューDB等）で `prisma migrate deploy` だけを実行しても
-- 失敗しないよう、同一定義をここでも冪等に用意する。
CREATE OR REPLACE FUNCTION get_my_user_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM "User" WHERE "supabaseId" = auth.uid()::text LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_same_family(other_user_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM "User" u1
    JOIN "User" u2 ON u1."familyId" = u2."familyId"
    WHERE u1."supabaseId" = auth.uid()::text
      AND u2.id = other_user_id
      AND u1."familyId" IS NOT NULL
  );
$$;

-- RLS 有効化 + SELECT ポリシー（役割別、supabase/seed.sql と同一内容・冪等）
--   PARENT: 同 family の全 TreasureLog（承認センターで子供全員分を見る）
--   CHILD : 自分の childId の行のみ
ALTER TABLE "TreasureLog" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'TreasureLog' AND policyname = 'realtime_select_treasure_logs'
  ) THEN
    CREATE POLICY "realtime_select_treasure_logs" ON "TreasureLog" FOR SELECT
    USING (
      "childId" = get_my_user_id()
      OR (
        is_same_family("childId")
        AND EXISTS (
          SELECT 1 FROM "User" u
          WHERE u."supabaseId" = auth.uid()::text AND u.role = 'PARENT'
        )
      )
    );
  END IF;
END $$;
