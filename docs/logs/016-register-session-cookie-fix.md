# 016: アカウント登録時のセッションcookie未反映エラー修正

## 概要
アカウント作成時に「登録に失敗しました」と表示されるが、実際にはSupabase Authにユーザーが作成されている問題を修正。

## 原因
登録フローは以下の2ステップ:
1. クライアント側で `signUp()` → Supabase Authにユーザー作成＋ブラウザcookie設定
2. `/api/auth/register` にPOST → サーバー側で `getUser()` してDBレコード作成

ステップ2で、**`signUp()`直後のセッションcookieが次の`fetch()`リクエストに反映されない**ことがある。
- `signUp()`はブラウザのcookieを非同期で設定する
- 直後の`fetch()`では、cookieがまだ設定完了していない場合がある
- 結果: サーバー側の`getUser()`がnullを返し、401エラー

Supabase Auth自体にはユーザーが作られているため、2回目の登録では「already exists」が返る。

## 修正内容

### register/page.tsx
- `signUp()`のレスポンスから`data.user.id`（supabaseId）を取得
- `/api/auth/register`のリクエストbodyに`supabaseId`を含めて送信

### api/auth/register/route.ts
- リクエストbodyから`supabaseId`を受け取る
- `supabaseId`がある場合はそれを使用、なければセッションcookieからフォールバック
- DBレコード作成時に渡されたsupabaseIdを使用

## 変更ファイル
- **`src/app/(auth)/register/page.tsx`**: signUpレスポンスからsupabaseIdをAPIに渡す
- **`src/app/api/auth/register/route.ts`**: bodyからsupabaseIdを受け取りフォールバック対応
