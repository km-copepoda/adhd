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
