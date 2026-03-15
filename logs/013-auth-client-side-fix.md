# 013: ログイン/登録をクライアント側Supabase認証に変更

## 概要
ログイン後にタスク作成・ファミリーコード表示ができない問題を修正。
原因はAPI Route Handler経由のSupabase認証ではセッションクッキーがブラウザに正しく設定されないこと。

## 原因
- ログイン/登録処理が `/api/auth/login`（サーバー側）経由で行われていた
- Route Handlerの `cookieStore.set()` でセッションクッキーを設定しても、ブラウザに正しく渡らないケースがある
- 結果: ログイン後のページで `getCurrentUser()` が null を返し、全APIが未認証として動作

## 修正内容

### ログイン（`src/app/(auth)/login/page.tsx`）
- **変更前**: `/api/auth/login` にPOSTしてサーバー側で `signInWithPassword`
- **変更後**: クライアント側で `createClient()` を使い直接 `signInWithPassword` を呼ぶ
  - `@supabase/ssr` の `createBrowserClient` が自動的にcookieを管理
  - 成功後 `window.location.href` でフルリロード遷移

### 登録（`src/app/(auth)/register/page.tsx`）
- **変更前**: `/api/auth/register` にPOSTしてサーバー側で `signUp` + DB作成
- **変更後**: クライアント側で `signUp` → 成功後に `/api/auth/register` を呼んでDB作成のみ
  - `signUp` でセッションがブラウザに設定される
  - API側はセッションから `getUser()` でsupabaseIdを取得してDBレコードを作成

### 登録API（`src/app/api/auth/register/route.ts`）
- **変更前**: リクエストbodyから email/password を受け取り `signUp` + DB作成
- **変更後**: セッションから `getUser()` でユーザーを取得し、DBレコードのみ作成
  - 既存ユーザーチェック追加（二重登録防止）

## ポイント
- Supabase SSRの推奨パターン: 認証はクライアント側で行い、サーバーはセッションcookieを読むだけ
- `window.location.href` でフルリロード遷移することでミドルウェアのセッション更新を確実に通す
- `router.push()` はSPAナビゲーションのためクッキーの再読み込みが不十分になることがある

## ビルド確認
- `npx next build` 成功（エラーなし）
