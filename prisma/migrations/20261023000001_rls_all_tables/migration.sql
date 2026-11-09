-- RLS とポリシーの正本（#215 #216 #217）。すべて冪等。
--
-- 方針:
--   * 全テーブルで RLS を有効化する。Prisma は postgres ロール（BYPASSRLS）で接続するため API には影響しない
--     （FORCE ROW LEVEL SECURITY は使わない）。ポリシーは Realtime(postgres_changes) で購読するテーブルにだけ作る
--   * 管理対象ポリシーは DROP POLICY IF EXISTS -> CREATE POLICY で定義を収束させる
--   * SECURITY DEFINER 関数は search_path を固定し、anon / PUBLIC から実行できないようにする
--   * 旧 supabase/seed.sql にあった RLS・ポリシー・関数定義はここに移した（二重管理しない）
--   * 本番は ChildRejoinAttempt も RLS 有効だが、PR #195 の migration で有効化済みのためここでは扱わない

-- 1. RLS 有効化（既に有効なら no-op）
ALTER TABLE "Family" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FamilyMonsterTheme" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestInstance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Streak" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CheckinLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TaskStreak" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserBadge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GatheringGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Stamp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GatheringMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestDeclaration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TreasureItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TreasureLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserCollectionItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BulletinLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- 2. RLS 再帰を避けるための SECURITY DEFINER ヘルパー関数
CREATE OR REPLACE FUNCTION get_my_family_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT "familyId" FROM "User" WHERE "supabaseId" = auth.uid()::text LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_my_user_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM "User" WHERE "supabaseId" = auth.uid()::text LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_same_family(other_user_id text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "User" u1
    JOIN "User" u2 ON u1."familyId" = u2."familyId"
    WHERE u1."supabaseId" = auth.uid()::text
      AND u2.id = other_user_id
      AND u1."familyId" IS NOT NULL
  );
$$;

-- 呼び出し元が親（User.role = 'PARENT'）か
CREATE OR REPLACE FUNCTION is_parent()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "User"
    WHERE "supabaseId" = auth.uid()::text AND role = 'PARENT'
  );
$$;

-- あつまりグループの閲覧可否: メンバー本人、またはメンバーと同じ家族の親
CREATE OR REPLACE FUNCTION can_view_gathering_group(gid text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "GatheringMember" gm
    JOIN "User" m ON m.id = gm."childId"
    WHERE gm."groupId" = gid
      AND (
        m."supabaseId" = auth.uid()::text
        OR (is_same_family(m.id) AND is_parent())
      )
  );
$$;

-- 3. 関数の実行権限
--   PUBLIC からは外し、ポリシーを評価する anon / authenticated にだけ付与する。
--   anon からも外すと、未ログインのクエリ・Realtime がポリシー評価時に「permission denied for function」
--   で失敗する（空の結果ではなくエラーになる）。どの関数も auth.uid() が NULL なら false を返すので anon に付与してよい。
--   素の Postgres には anon / authenticated が無いので存在を確認する。
DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION get_my_family_id() FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION get_my_user_id() FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION is_same_family(text) FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION is_parent() FROM PUBLIC;
  REVOKE EXECUTE ON FUNCTION can_view_gathering_group(text) FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT EXECUTE ON FUNCTION get_my_family_id() TO anon;
    GRANT EXECUTE ON FUNCTION get_my_user_id() TO anon;
    GRANT EXECUTE ON FUNCTION is_same_family(text) TO anon;
    GRANT EXECUTE ON FUNCTION is_parent() TO anon;
    GRANT EXECUTE ON FUNCTION can_view_gathering_group(text) TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT EXECUTE ON FUNCTION get_my_family_id() TO authenticated;
    GRANT EXECUTE ON FUNCTION get_my_user_id() TO authenticated;
    GRANT EXECUTE ON FUNCTION is_same_family(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION is_parent() TO authenticated;
    GRANT EXECUTE ON FUNCTION can_view_gathering_group(text) TO authenticated;
  END IF;
END $$;

-- 4. SELECT ポリシー（Realtime 用）
DROP POLICY IF EXISTS "realtime_select_quests" ON "QuestInstance";
CREATE POLICY "realtime_select_quests" ON "QuestInstance" FOR SELECT
USING (is_same_family("childId"));

DROP POLICY IF EXISTS "realtime_select_tasks" ON "TaskTemplate";
CREATE POLICY "realtime_select_tasks" ON "TaskTemplate" FOR SELECT
USING ("familyId" = get_my_family_id());

DROP POLICY IF EXISTS "realtime_select_badges" ON "UserBadge";
CREATE POLICY "realtime_select_badges" ON "UserBadge" FOR SELECT
USING ("userId" = get_my_user_id());

-- PARENT: 同 family の全 TreasureLog / CHILD: 自分の childId の行のみ
DROP POLICY IF EXISTS "realtime_select_treasure_logs" ON "TreasureLog";
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

-- #215: 子どもには自分の行だけ。同じ家族の他メンバー（兄弟の childCode 等）は親だけが読める
DROP POLICY IF EXISTS "realtime_select_users" ON "User";
CREATE POLICY "realtime_select_users" ON "User" FOR SELECT
USING ("supabaseId" = auth.uid()::text OR (is_same_family(id) AND is_parent()));

-- #216: あつまりの Realtime（BulletinLog / Stamp INSERT）を配信するための SELECT ポリシー
DROP POLICY IF EXISTS "realtime_select_bulletin_logs" ON "BulletinLog";
CREATE POLICY "realtime_select_bulletin_logs" ON "BulletinLog" FOR SELECT
USING (can_view_gathering_group("groupId"));

DROP POLICY IF EXISTS "realtime_select_stamps" ON "Stamp";
CREATE POLICY "realtime_select_stamps" ON "Stamp" FOR SELECT
USING (can_view_gathering_group("groupId"));
