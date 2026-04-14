# MVP 初期セットアップ完了

**日時:** 2026-03-11
**ブランチ:** vk/5d67-mvp

## 概要
QuestBoard MVP の全コードベースを新規作成。プロジェクト初期化からフルスタック実装まで一括で構築。

## 技術スタック
- **フレームワーク:** Next.js 16.1.6 (App Router, Turbopack)
- **言語:** TypeScript
- **スタイリング:** Tailwind CSS v4
- **DB:** Supabase (Docker ローカル) + PostgreSQL
- **ORM:** Prisma v7 (PrismaPg adapter)
- **認証:** Supabase Auth (親=メール認証, 子=匿名認証)

## 作成したファイル一覧

### インフラ・設定
- `prisma/schema.prisma` - DBスキーマ (Family, User, TaskTemplate, QuestInstance)
- `prisma.config.ts` - Prisma v7 設定 (datasource URL)
- `prisma/migrations/20260310152742_init/` - 初回マイグレーション
- `supabase/config.toml` - Supabase ローカル設定 (analytics無効化, 匿名認証有効化)
- `.env` - 環境変数 (Supabase ローカルキー + DB URL)
- `src/middleware.ts` - Supabase セッション管理

### ライブラリ
- `src/lib/prisma.ts` - PrismaClient シングルトン (PrismaPg adapter)
- `src/lib/constants.ts` - ゲーム定数 (XP, モンスター進化, カテゴリ等)
- `src/lib/auth.ts` - 認証ヘルパー (getCurrentUser)
- `src/lib/supabase/client.ts` - ブラウザ用Supabaseクライアント
- `src/lib/supabase/server.ts` - サーバー用Supabaseクライアント
- `src/lib/supabase/middleware.ts` - セッション更新ミドルウェア
- `src/types/index.ts` - 共有型定義 (クライアント用、Prisma非依存)

### 子ども向けページ (モバイル)
- `src/app/child/layout.tsx` - ボトムナビ付きシェル (max-w-md)
- `src/app/child/onboarding/page.tsx` - 4ステップオンボーディング (名前→サイド選択→モンスター誕生)
- `src/app/child/quests/page.tsx` - 今日のクエスト一覧 + 完了報告フォーム
- `src/app/child/monster/page.tsx` - モンスター育成画面 (パラメータ表示、レベル、進化ヒント)
- `src/components/child/BottomNav.tsx` - 5タブボトムナビ (クエスト/育成のみアクティブ)

### 親向けページ (デスクトップ)
- `src/app/parent/layout.tsx` - サイドバー付きレイアウト
- `src/app/parent/tasks/page.tsx` - タスク管理CRUD (難易度/カテゴリ/曜日選択)
- `src/app/parent/approve/page.tsx` - 承認センター (個別/一括承認、差し戻し)
- `src/app/parent/family/page.tsx` - ファミリーコード管理 + メンバー一覧
- `src/components/parent/Sidebar.tsx` - サイドバーナビゲーション

### 認証ページ
- `src/app/(auth)/login/page.tsx` - 親ログイン
- `src/app/(auth)/register/page.tsx` - 親アカウント作成

### APIルート
- `src/app/api/auth/register/route.ts` - 親アカウント作成 (Supabase signUp + Family/User作成)
- `src/app/api/auth/login/route.ts` - 親ログイン
- `src/app/api/auth/child-join/route.ts` - 子ども参加 (匿名認証 + ファミリーコード紐付け)
- `src/app/api/tasks/route.ts` - タスクテンプレート一覧・作成
- `src/app/api/tasks/[id]/route.ts` - タスク更新・削除
- `src/app/api/quests/today/route.ts` - 当日クエスト取得 (自動生成含む)
- `src/app/api/quests/[id]/report/route.ts` - クエスト完了報告
- `src/app/api/approve/pending/route.ts` - 承認待ち一覧
- `src/app/api/approve/[id]/route.ts` - 承認/差し戻し (パラメータ加算)
- `src/app/api/monster/route.ts` - モンスター情報取得
- `src/app/api/family/code/route.ts` - ファミリーコード取得・生成

### その他
- `src/app/page.tsx` - ランディングページ
- `src/app/layout.tsx` - ルートレイアウト (Noto Sans JP + Cinzel)
- `src/app/globals.css` - QuestBoardテーマ (ダークモード、ゴールドアクセント)
- `public/manifest.json` - PWA マニフェスト

## 修正した既存ファイル
- `src/app/layout.tsx` - Next.jsデフォルト → QuestBoardテーマに変更
- `src/app/page.tsx` - Next.jsデフォルト → ランディングページに変更
- `src/app/globals.css` - デフォルトCSS → QuestBoardカスタムテーマ

## 解決した問題

### 1. Supabase Docker ソケットエラー
- **問題:** `supabase start` で `mkdir docker.sock: operation not supported` エラー
- **原因:** Rancher Desktop の Docker ソケットを analytics コンテナがマウントしようとして失敗
- **解決:** `supabase/config.toml` で `[analytics] enabled = false` に設定

### 2. Prisma v7 の破壊的変更
- **問題:** `url = env("DATABASE_URL")` が schema.prisma でサポートされなくなった
- **解決:** `prisma.config.ts` に datasource URL を移動

### 3. Prisma v7 の Client API 変更
- **問題:** `new PrismaClient()` が引数なしで呼べなくなった (adapter必須)
- **解決:** `@prisma/adapter-pg` + `PrismaPg` アダプターパターンに移行

### 4. Turbopack モジュール解決
- **問題:** `@/generated/prisma` からの import が解決できない
- **解決:** `@/generated/prisma/client` と `@/generated/prisma/enums` に具体パス指定

### 5. クライアントコンポーネントでの Prisma 型
- **問題:** "use client" ファイルで Prisma generated 型を import するとバンドルに含まれる
- **解決:** `src/types/index.ts` にクライアント用の軽量型定義を作成

## DB スキーマ概要
```
Family (id, code, createdAt)
  ├── User (id, supabaseId, role, name, side, monsterName, studyPt, staminaPt, lifePt)
  └── TaskTemplate (id, title, emoji, category, difficulty, repeatDays, isActive)
        └── QuestInstance (id, date, status, comment, reportedAt, approvedAt)
            └── @@unique([templateId, childId, date])
```

## 動作確認
- `supabase start` → ローカル Docker 環境起動 (PostgreSQL + Auth + Studio)
- `npx prisma migrate dev` → DBテーブル作成成功
- `npm run build` → 全20ルート正常コンパイル
- `npm run dev` → http://localhost:3000 で正常起動 (200 OK)
