# CLAUDE.md — プロジェクト固有の注意事項

## Next.js 16 のミドルウェアエントリポイント

このプロジェクトの Next.js 16.1.6 は **標準の `src/middleware.ts` ではなく `src/proxy.ts`** をエントリポイントとして使用する。

### ルール
- ファイル名: `src/proxy.ts`（`src/middleware.ts` は deprecated 警告が出てビルドが通らない）
- エクスポート関数名: **`proxy`**（`middleware` だと Turbopack ビルドエラー: "Proxy is missing expected function export name"）

```ts
// src/proxy.ts — 正しい書き方
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}
export const config = { matcher: [...] };
```

### やってはいけないこと
- `src/middleware.ts` にリネームする → ビルド警告＋エラー
- `export function middleware()` という名前にする → Turbopack エラー

---

## ルーティング規約

| 役割 | ログイン画面 | ホーム |
|------|-------------|--------|
| 親   | `/parent/login` | `/parent/tasks` |
| 子   | `/child/login`  | `/child/quests` |

- `/login` `/child/onboarding` は旧パスで現在は存在しない
- `src/app/parent/(app)/layout.tsx` が親ナビ（Sidebar + ParentBottomNav）を提供
- `/parent/login` は `(app)` の外にあるためナビなし

---

## テスト

- `npm test` — ユニットテスト（vitest、node 環境）
- テストファイルは `src/__tests__/` 以下
- `@/lib/push` はグローバルモック済み（`setup.ts`）。`push.test.ts` のみ `vi.unmock("@/lib/push")` で解除して実装テスト
