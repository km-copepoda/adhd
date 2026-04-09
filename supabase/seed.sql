-- quest-photos バケット作成（既存の場合はスキップ）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quest-photos',
  'quest-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 認証済みユーザー（子供・親）がアップロード可能にする
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'authenticated_upload_quest_photos'
  ) THEN
    CREATE POLICY "authenticated_upload_quest_photos"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'quest-photos');
  END IF;
END $$;

-- パブリック読み取り（img src で直接表示できるようにする）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'public_read_quest_photos'
  ) THEN
    CREATE POLICY "public_read_quest_photos"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'quest-photos');
  END IF;
END $$;

-- ============================================================
-- Supabase Realtime 用 RLS ポリシー
-- postgres_changes を正しくクライアントに届けるために必要
-- ============================================================

-- Realtime 未登録テーブルをパブリケーションに追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'TaskTemplate'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "TaskTemplate";
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'UserBadge'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "UserBadge";
  END IF;
END $$;

-- RLS 再帰を避けるための SECURITY DEFINER ヘルパー関数
CREATE OR REPLACE FUNCTION get_my_family_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT "familyId" FROM "User" WHERE "supabaseId" = auth.uid()::text LIMIT 1;
$$;

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

-- RLS 有効化 + SELECT ポリシー（べき等）
ALTER TABLE "QuestInstance" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'QuestInstance' AND policyname = 'realtime_select_quests'
  ) THEN
    CREATE POLICY "realtime_select_quests" ON "QuestInstance" FOR SELECT
    USING (is_same_family("childId"));
  END IF;
END $$;

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'User' AND policyname = 'realtime_select_users'
  ) THEN
    CREATE POLICY "realtime_select_users" ON "User" FOR SELECT
    USING ("supabaseId" = auth.uid()::text OR is_same_family(id));
  END IF;
END $$;

ALTER TABLE "TaskTemplate" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'TaskTemplate' AND policyname = 'realtime_select_tasks'
  ) THEN
    CREATE POLICY "realtime_select_tasks" ON "TaskTemplate" FOR SELECT
    USING ("familyId" = get_my_family_id());
  END IF;
END $$;

ALTER TABLE "UserBadge" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'UserBadge' AND policyname = 'realtime_select_badges'
  ) THEN
    CREATE POLICY "realtime_select_badges" ON "UserBadge" FOR SELECT
    USING ("userId" = get_my_user_id());
  END IF;
END $$;
