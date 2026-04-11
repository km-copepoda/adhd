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

## 進化処理の規約

`checkEvolution` を呼ぶ場所は `src/lib/approve.ts` の `approveQuestInstance` を正規パターンとし、以下を必ず守ること。

### 必須チェックリスト
1. **rebirthPending チェックを先に行う** - `trur` なら XP 加点のみで進化チェックをスキップ
2. **isReborn を渡す** - `collectedPaths.length > 0` で判定（転生卵の孵化閾値が変わる）
3. **rebirthEggBonus を渡す** - 卵選択ボーナスの進化確率補正に必要
4. **進化後に collectedPaths を更新する** - 新パスが未登録なら追加
5. **進化後に monsterLevels を更新する** - stage 3 到達時にカウントアップ
6. **転生閾値到達時は rebirthPending=true をセットし、ステージリセットはしない** - リセットはユーザ操作（rebirth API）で行う

### やってはいけないこと
- `checkEvolution(stage, path, study, stamina, life)` と引数3つだけで呼ぶ（isReborn/eggBonus が欠落する）
- 進化結果の `resetStudy`/`resetStamina`/`resetLife` だけ保存して `collectedPaths`/`monsterLevels` を無視する
- XP を加算する処理で `rebirthPending` を確認せずに進化チェックを走らせる

### 該当箇所
- `src/lib/approve.ts` - 正規パターン（参照元）
- `src/lib/streak.ts` - マイルストーンボーナス付与時
- `src/lib/loginStreak.ts` - ログインストリークボーナス付与時

---

## XP 操作時の注意

- **XP 付与は承認時（APPROVED）のみ** REPORTED 状態ではまだ付与されていない
- **XP 回収（clawback）は APPROVED クエストのみ対象** REPORTED を含めると未付与分まで差し引いてしまう
- **複数クエストの XP を操作する場合は最新の child データを DB から取得する** ループ内でスナップショットを使いまわすと state data で上書きが発生する

---

## ステータス遷移の規約

クエストのステータス推移は以下のみ許可:

```
PENDING -> REPORTED（子供が報告）
PENDING -> SKIP_REPORTED（子供がスキップ申請）
REPORTED -> APPROVED（親が承認）
REPORTED -> REJECTED（親が差し戻し）
REJECTED -> REPORTED（子供が再報告）
SKIP_REPORTED -> SKIPPED（親がスキップ承認）
SKIP_REPORTED -> PENDING（親がスキップ却下）
```

承認・却下 API では操作前にステータスを検証し、不正な遷移を拒否すること。

---

## 日付・タイムゾーンの規約

- **日付は JST 基準** `src/lib/date.ts` の関数を使う
- DB の `@db.Date` 型は「JST 日付を UTC 0:00 として保存」する規約
- **曜日は `.getUTCDay()` を使う** (`.getDay()` はサーバの TZ に依存する)
- `Date.UTC()` で構築した日付の曜日・日数取得には必ず `getUTC*` 系メソッドを使う

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
