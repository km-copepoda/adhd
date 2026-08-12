This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🛠 Cline 開発フロー規約 (MUST)

Clineがタスク（Kanban）に着手する際は、以下のステップを厳守すること。

### 1. 準備 (Preparation)
- **環境構築**: 必要な環境変数がない場合、`.env.example` から `.env.local` (または `.env`) をコピーして作成せよ。
- **ブランチ作成**: `main` から直接作業せず、必ず `feature/task-name` のように新しいブランチを作成して切り替えよ。

### 2. テスト駆動開発 (TDD) サイクル
実装を開始する前に、以下の「Red-Green-Refactor」を回すこと。
1. **Red**: `src/__tests__/` に修正内容を検証する失敗するテストを作成し、`npm test` で失敗を確認する。
2. **Green**: テストをパスさせるための最小限の実装を行う。
3. **Refactor**: コードを整理し、再度テストが通ることを確認する。
**※ テストがパスするまで、実装完了を宣言してはならない。**

### 3. 完了報告
- 実装完了後、テストがすべてパスしていることを確認し、コミットせよ。
- コミット後、元のブランチへプルリクエストを送る準備を整えよ（または指示に従いマージせよ）。

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
REJECTED -> SKIP_REPORTED（子供が差し戻し後にスキップ申請 / rejectionReason は自動クリア）
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

## コード構成規約

### `src/lib/` のモジュール分割ルール

lib 内のファイルは **1ファイル1責務** を原則とし、以下のように分類する。

| 分類 | ファイル例 | ルール |
|------|-----------|--------|
| データ定義 | `monsters.ts`, `badges.data.ts`, `categories.ts` | 純粋なデータ（定数・テーブル）。DB依存なし |
| ビジネスロジック | `evolution.ts`, `streakMilestones.ts`, `badges.data.ts` | 純粋関数。副作用なし、テスト容易 |
| DB操作 | `badges.ts`, `approve.ts`, `streak.ts` | Prisma を使う処理。純粋関数はデータ定義側に置く |
| インフラ | `prisma.ts`, `auth.ts`, `logger.ts`, `push.ts` | 外部サービス接続 |
| UIユーティリティ | `confetti.ts`, `spinner.ts`, `ios-install.ts` | クライアント専用の小さなヘルパー |

#### やってはいけないこと
- **1ファイルにデータ定義・ロジック・DB操作を混在させない**（旧 `constants.ts` / 旧 `badges.ts` の失敗パターン）
- **バレルファイル（re-export だけのファイル）を作らない** — インポート元を直接指定する

#### 新規ファイル追加時
- 300行を超えそうなら分割を検討する
- 純粋関数と DB 操作は別ファイルに分ける（テストしやすさのため）

### XP 計算

XP 計算は **`src/lib/xp.ts`** の `calculateQuestXP()` を使う。

```ts
import { calculateQuestXP } from "@/lib/xp";
const xp = calculateQuestXP(quest); // 1 + deadlineBonus + photoBonus
```

API ルート内で `let xp = 1; if (...) xp++; ...` と手書きしない。

### 進化ロジックのインポート先

| 用途 | インポート元 |
|------|-------------|
| `checkEvolution`, `getXpInfo`, `REBIRTH_THRESHOLD` 等 | `@/lib/evolution` |
| `MONSTER_TABLE`, `getMonsterStage`, `getEvolutionChildren` | `@/lib/monsters` |
| `CATEGORY_LABEL`, `CATEGORY_COLOR`, `DAY_LABELS` 等 | `@/lib/categories` |
| `STREAK_MILESTONES`, `getStreakTitle`, `distributeBonus` 等 | `@/lib/streakMilestones` |
| `ALL_BADGES`, `checkBadgeConditions`, `BadgeContext` 型 | `@/lib/badges` または `@/lib/badges.data` |

旧 `@/lib/constants` は削除済み。使わないこと。

### コンポーネント分割ルール

#### ファイル配置

```
src/components/
  child/          ← 子供画面専用
  parent/         ← 親画面専用
  *.tsx           ← 共有コンポーネント
```

#### 分割の判断基準
- ページコンポーネントが **500行を超えたら** フォームやモーダルの抽出を検討する
- **再利用可能な UI パーツ**（モーダル、カットイン等）は `components/` に抽出する
- ページ固有のロジックはページ内に残してよい

#### 既存の抽出済みコンポーネント
- `components/parent/TaskForm.tsx` — タスク作成・編集フォーム
- `components/child/EggSelectionModal.tsx` — 転生時の卵選択
- `components/child/CutsceneOverlay.tsx` — 進化・孵化・転生・実績のカットイン演出

### カスタムフック

| フック | 用途 |
|-------|------|
| `hooks/useApiFetch.ts` | 汎用APIフェッチ（loading/error/data + refetch） |
| `hooks/usePendingApprovalCount.ts` | 承認待ち件数（Realtime + 可視性検出） |

新しいデータフェッチが必要な場合は `useApiFetch` の利用を検討する。ただし Supabase Realtime やカスタム変換が必要な場合はページ内で直接書いてよい。

### 認証ヘルパー

```ts
import { getCurrentUser, requireUser, AuthError } from "@/lib/auth";

// ロール不問（未認証のみ拒否）
const user = await requireUser();

// ロール指定
const parent = await requireUser("PARENT");
```

`requireUser` は未認証時に `AuthError` をスローする。API ルートでは引き続き `getCurrentUser()` + 手動チェックでもよい。

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

---

## サブエージェント運用フロー

このプロジェクトでは Claude Code のサブエージェント機能を利用する。`.claude/agents/` に定義済み。

### エージェント一覧と使用順序

| # | エージェント | 役割 | 起動タイミング |
|---|--------------|------|----------------|
| 0 | `issue-planner` | ユーザーの雑な指示を目的・背景・実装方針・影響範囲・テスト要件・エッジケースまで深掘りし `gh issue create`（Issue自動着手パイプライン用。通常の対話フローでは不要） | Issue化されていない指示を Issue 自動着手パイプラインに乗せたい場合のみ |
| 1 | `policy-checker` | `docs/decisions.md` / `CLAUDE.md` 参照、方針衝突・非標準アプローチ検出 | タスク着手時（必ず最初） |
| 2 | `test-writer` | TDD Red: `src/__tests__/` に失敗テストを書く | `policy-checker` が OK / ユーザー確認後 |
| 3 | `implementer` | TDD Green + Refactor: 最小実装 → 規約準拠に整理 | `test-writer` の失敗テスト取得後 |
| 4 | `code-reviewer` | プロジェクト規約に照らして最終レビュー | `implementer` 完了後、PR 前 |
| 5 | `pr-submitter` | ブランチ作成・コミット・push・PR 作成 | `code-reviewer` が APPROVED を出した後のみ |

### 基本フロー

```
指示受領
  → policy-checker
  → (NEEDS_CONFIRMATION ならユーザーに確認、OK なら次へ)
  → test-writer (Red)
  → implementer (Green + Refactor)
  → code-reviewer (APPROVED か CHANGES_REQUESTED)
  → (CHANGES_REQUESTED なら implementer に戻る)
  → pr-submitter
```

### スキップしてよい場合

- **単純な質問への回答**（コード変更なし）: すべてスキップ
- **既存 doc の閲覧・調査のみ**（ファイルを書き換えない）: `policy-checker` 以降スキップ
- **1 行のバグ修正**: `policy-checker` は省略可（明らかに逆行しない場合）。`test-writer` は必須。
- **`code-reviewer` は「ファイルを書き換える」作業である限り省略しない**。`src/` のアプリケーションコードだけでなく `.claude/agents/*.md`・`.claude/commands/*.md`・`docs/decisions.md` 等の変更も対象。「設定/ドキュメントだから」「変更が小さいから」は省略理由にならない。

### 大きな仕様変更を含む場合

`code-reviewer` を通した後、`pr-submitter` に進む前に `docs/decisions.md` に決定理由を1エントリ追記する。追記フォーマットは同ファイルの既存エントリに準拠。

### Codex レビューの自動反復

`pr-submitter` が `@codex review Please review in Japanese.` を投稿した後、`/loop /codex-followup` を実行すると Codex のレビュー取得 → 対応 → 再依頼を最大 20 反復まで自動で回せる。詳細は `.claude/commands/codex-followup.md` を参照。指摘は UI / ロジック・パフォーマンス / QA の3カテゴリに判定した上で `implementer` に重点確認事項を注入する（専用エージェントには分けない）。

### Issue自動着手パイプライン（実装中）

雑な指示から Issue 化 → 自動実装 → PR → Codex レビュー反復 → マージ前ユーザー確認、まで一気通貫で回すためのパイプライン。設計・ラベル定義・盲点は `docs/未実装仕様書/issue-auto-pipeline.md` を参照。

```
ユーザーの雑な指示
  → issue-planner（深層思考でIssue化。gh issue create。ラベルは付けず、スコープ評価を本文に推奨として記載するのみ）
  → 人間が内容を確認し auto-pickup ラベルを付与（この操作だけが実際の着手許可。issue-planner自身は付与しない）
  → issue-picker（`.claude/commands/issue-picker.md`。auto-pickup Issueを1件拾い policy-checker 以降の通常フローに乗せる）
  → pr-submitter が PR 作成
  → /codex-followup がレビュー反復・マージ可否通知
  → ユーザーが手動マージ
```

- 現状の実装状況: `issue-planner` エージェント・6種のGitHubラベル（`auto-pickup`/`auto:in-progress`/`auto:pr-open`/`auto:merge-ready`/`auto:blocked`/`auto:done`）・`issue-picker` コマンドまでは実装済み。**Issue作成/PR作成を検知して自動起動するトリガー（webhook/cronルーティン）は未配線**なので、現状は `issue-planner` と `issue-picker` をそれぞれ手動で起動する運用
- マージは意図的に自動化しない（`/codex-followup` が「MERGE READY通知で停止」する設計をそのまま踏襲）
