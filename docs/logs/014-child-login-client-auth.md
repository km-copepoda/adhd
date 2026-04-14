# 014: 子どもログインをクライアント側匿名認証に変更

## 日付
2026-03-11

## 問題
子どもがファミリーコード + ユーザーコードでログインしても、`/child/quests` にアクセスできない（ミドルウェアに弾かれてリダイレクトされる）。

## 根本原因
013で親ログインを修正したのと同じパターン:

1. **サーバーサイド匿名認証の問題**: `child-rejoin` APIがRoute Handler内で `signInAnonymously()` を呼んでいたが、Route Handlerでのcookie設定はNext.js SSRの制約で正しくブラウザに反映されない
2. **`router.push` の問題**: ログイン成功後に `router.push("/child/quests")` を使用していたが、クライアントサイドルーティングではミドルウェアがセッションを再処理しない
3. **結果**: ブラウザにSupabaseセッションcookieがセットされず、ミドルウェアが未認証と判定して `/` にリダイレクト

## 修正内容

### `src/app/child/onboarding/page.tsx`
- `createClient` (ブラウザ用) をインポートし、クライアント側で `signInAnonymously()` を実行
- 取得した `user.id` を API に `supabaseUserId` として送信
- ログイン成功後は `window.location.href` でフルリロード（ミドルウェアがセッションを正しく処理するため）
- 不要になった `useRouter` のインポートを削除

### `src/app/api/auth/child-rejoin/route.ts`
- サーバーサイドの `createClient` (server) インポートを削除
- `signInAnonymously()` のサーバーサイド呼び出しを削除
- リクエストボディから `supabaseUserId` を受け取り、DBの `supabaseId` を更新するだけに変更
- APIの責務を「コード検証 + DB更新」のみに限定

## 設計方針
013の修正と同じパターンを適用:
- **認証はクライアント側**で行い、cookieが正しくブラウザにセットされるようにする
- **APIはDB操作のみ**に責務を限定する
- **ページ遷移は `window.location.href`** でフルリロードし、ミドルウェアがセッションを処理できるようにする

## 変更ファイル
- `src/app/child/onboarding/page.tsx`
- `src/app/api/auth/child-rejoin/route.ts`
