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

```bash
npx prisma migrate dev --name <migration_name>
npx prisma generate
rm -rf .next
docker restart supabase_realtime_adhd
```

Turbopack がキャッシュするため `.next` 削除 + dev サーバー再起動が必須。

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
