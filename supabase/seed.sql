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
-- Supabase Realtime publication
-- RLS・ポリシー・SECURITY DEFINER 関数の正本は
-- prisma/migrations/20261023000001_rls_all_tables（ここでは定義しない）
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
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'QuestInstance'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "QuestInstance";
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'User'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "User";
  END IF;
  -- #151: ごほうび使用申請の親承認フロー用（承認センター / バッジカウントの Realtime 購読）
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'TreasureLog'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "TreasureLog";
  END IF;
  -- #216: あつまり（掲示板ログ・スタンプ）の Realtime 購読
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'BulletinLog'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "BulletinLog";
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'Stamp'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE "Stamp";
  END IF;
END $$;
