# 011: Supabaseポート変更（mySupabaseとの共存対応）

## 概要
別プロジェクト（mySupabase）がデフォルトポート（54321/54322）を使用していたため、adhdプロジェクトのSupabaseポートを5433x系に変更した。

## 原因
- `supabase start` 時に `Bind for 0.0.0.0:54322 failed: port is already allocated` エラー
- `supabase_db_mySupabase` コンテナがポート54322を占有していた

## 変更内容

### ポートマッピング（旧→新）

| サービス | 旧ポート | 新ポート |
|---------|---------|---------|
| API (Kong) | 54321 | **54331** |
| Database (PostgreSQL) | 54322 | **54332** |
| Shadow DB | 54320 | **54330** |
| Studio | 54323 | **54333** |
| Inbucket (Mail) | 54324 | **54334** |
| Analytics | 54327 | **54337** |
| Pooler | 54329 | **54339** |

### 変更ファイル
- **`supabase/config.toml`**: 全ポートを5433x系に変更
- **`.env`**: DATABASE_URL, DIRECT_URL, NEXT_PUBLIC_SUPABASE_URLのポートを更新
- **`docker-compose.yml`**: host.docker.internal経由の接続先ポートを更新

## 確認結果
- `supabase start` → 正常起動
- `prisma db push` → スキーマ同期済み（バックアップから復元）
- mySupabaseと同時起動が可能
