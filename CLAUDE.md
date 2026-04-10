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
| 親   | `/app/parent/login` | `/app/parent/tasks` |
| 子   | `/app/child/login`  | `/app/child/quests` |

- `/` = LP（常に公開、ログイン済みでもリダイレクトしない）
- `/login` = ログイン選択画面（ログイン済みならホームへリダイレクト）
- `/app/register` = 親アカウント新規登録
- `src/app/app/parent/(app)/layout.tsx` が親ナビ（Sidebar + ParentBottomNav）を提供
- `/app/parent/login` は `(app)` の外にあるためナビなし
- 旧パス（`/parent/*`, `/child/*`, `/register`）は廃止済み

---

## テスト

- `npm test` — ユニットテスト（vitest、node 環境）
- テストファイルは `src/__tests__/` 以下
- `@/lib/push` はグローバルモック済み（`setup.ts`）。`push.test.ts` のみ `vi.unmock("@/lib/push")` で解除して実装テスト
- **開発はテスト駆動（TDD）で行う**
- テストは必ず書く。境界値テストも含めること

---

## 承認ロジック

承認処理の共有ロジックは **`src/lib/approve.ts`** に集約済み。

- `approveQuestInstance(id)` — タスク完了承認（XP付与・ストリーク更新・バッジチェック含む）
- `approveSkipQuestInstance(id)` — スキップ承認

新たな承認フローを追加する場合はここに追記し、各 API ルートから呼び出す。APIルート内に承認ロジックを直接書かない。

---

## Claude への作業指示

### 指示を受ける前に
- 作業開始前に `docs/decisions.md` を参照し、プロジェクト方針を把握する
- 現在の方針と**明らかに逆行する指示**の場合のみ確認を求める
- 一般的でない（非標準の）修正手法を使おうとする場合も確認を求める

### 記録のルール
- **大きな仕様変更があった場合のみ** `docs/decisions.md` に決定理由を簡潔に追記する
- 細かな修正（バグ修正・ログ追加・リファクタリング等）は記録不要
- diff や修正ログを毎回読み返す必要はない
