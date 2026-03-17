# QuestBoard - ADHD タスク管理アプリ

子どもの習慣化をゲーミフィケーションで支援するアプリ。

## 技術スタック

- Next.js 16 (App Router, Turbopack)
- TypeScript / Tailwind CSS v4
- Prisma v7 + PostgreSQL
- Supabase (認証 + Realtime)

## セットアップ

```bash
npm install
```

### Supabase ローカル起動

```bash
npx supabase start
```

### DB セットアップ

```bash
npx prisma migrate deploy
npx prisma generate
```

### 開発サーバー

```bash
npm run dev
```

http://localhost:3000 で起動。

## DB リセット手順

データを全削除してスキーマを再適用する場合:

```bash
npx prisma migrate reset
docker restart supabase_realtime_adhd
```

- `migrate reset` で DB 全削除 → マイグレーション全適用 → Prisma Client 再生成
- Realtime サービスは publication 変更を起動時に読み込むため再起動が必要

## Prisma スキーマ変更後

`prisma migrate dev` は Supabase のシャドウ DB 制約で失敗するため、以下の手順を使う。

### 1. ローカル DB に反映

```bash
npx prisma db push
npx prisma generate
rm -rf .next
docker restart supabase_realtime_adhd
```

Turbopack がキャッシュするため `.next` 削除 + dev サーバー再起動が必須。

### 2. マイグレーションファイルを手動作成

`prisma/migrations/YYYYMMDDHHMMSS_<名前>/migration.sql` を作成し、変更内容の SQL を記述する。

```sql
-- 例: カラム追加
ALTER TABLE "SomeTable" ADD COLUMN "newColumn" TEXT;
```

### 3. ローカルの migration 履歴に登録

```bash
npx prisma migrate resolve --applied <YYYYMMDDHHMMSS_名前>
```

### 4. 本番への反映（Vercel 経由で自動）

`package.json` の `build` スクリプトに `prisma migrate deploy` が含まれているため、
Vercel へのデプロイ時に自動でマイグレーションが適用される。

```json
"build": "prisma migrate deploy && prisma generate && next build"
```

> 本番の `DATABASE_URL` は Vercel の Environment Variables に設定すること。

## 主な画面

| パス | 画面 |
|------|------|
| `/register` | 親アカウント作成 |
| `/login` | 親ログイン |
| `/child/onboarding` | 子どもログイン（コード認証） |
| `/parent/tasks` | タスク管理 |
| `/parent/approve` | 承認センター |
| `/parent/family` | ファミリー管理 |
| `/child/quests` | 今日のクエスト |
| `/child/monster` | モンスター育成 |
