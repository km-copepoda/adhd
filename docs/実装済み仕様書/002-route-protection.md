# ルート保護（認証チェック）追加

**日時:** 2026-03-11

## 問題
未ログイン状態でも `/parent/tasks` や `/child/quests` に直接アクセスできてしまい、ログイン画面を経由しない。

## 修正内容

### `src/lib/supabase/middleware.ts`
- ルート保護ロジックを追加
- 公開ルート定義: `/`, `/login`, `/register`, `/child/onboarding`
- 未認証で親ルート (`/parent/*`) → `/login` にリダイレクト
- 未認証で子ルート (`/child/quests`, `/child/monster`) → `/` にリダイレクト
- 認証済みで `/login` or `/register` → `/parent/tasks` にリダイレクト
- APIルート (`/api/*`) は認証チェックスキップ（各API内で個別チェック）

## テスト結果
| ルート | 未認証 | 認証済み |
|--------|--------|----------|
| `/parent/*` | 307 → `/login` | 200 OK |
| `/child/quests`, `/child/monster` | 307 → `/` | 200 OK |
| `/`, `/child/onboarding` | 200 OK | 200 OK |
| `/login`, `/register` | 200 OK | 307 → `/parent/tasks` |
