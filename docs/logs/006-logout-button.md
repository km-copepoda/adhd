# ログアウトボタン追加

**日時:** 2026-03-11

## 指示
ログアウトボタンをつけてほしい。

## 既存ログとの矛盾チェック
- logs/001〜005: ログアウト機能は一度も実装されていない → 矛盾なし、純粋な新機能追加

## 修正内容

### 変更: `src/components/parent/Sidebar.tsx`
- サイドバー下部（`mt-auto`）にログアウトボタン追加
- `supabase.auth.signOut()` 後に `/login` へリダイレクト
- ホバー時に赤色ハイライト

### 変更: `src/components/child/BottomNav.tsx`
- 「プロフ」タブ（disabled）を削除し、代わりにログアウトボタンを追加
- `supabase.auth.signOut()` 後に `/child/onboarding` へリダイレクト
- ホバー時に赤色ハイライト

## ログアウト後の遷移先
| 画面 | ログアウト後 |
|------|-------------|
| 親 (Sidebar) | `/login` |
| 子 (BottomNav) | `/child/onboarding` |
