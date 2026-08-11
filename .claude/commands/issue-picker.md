---
description: `auto-pickup` ラベルの付いたオープンIssueを1件拾い、方針チェック→TDD実装→PR作成まで自動で進める。`/loop /issue-picker` で定期実行できる。
---

# issue-picker

`auto-pickup` ラベルの付いた未着手Issueを1件だけ選び、`policy-checker` → `test-writer` → `implementer` → `code-reviewer` → `pr-submitter` の既存サブエージェントフローに乗せてPR作成まで進める。PR作成後のCodexレビュー対応は `/codex-followup` が引き継ぐ（本コマンドはそこには関与しない）。

設計の背景・ラベル設計・盲点の詳細は `docs/未実装仕様書/issue-auto-pipeline.md` を参照。

## 前提

- `gh` は `"C:\Program Files\GitHub CLI\gh.exe"` をPowerShellから呼ぶ
- ラベルは6種類、状態機械として扱う: `auto-pickup`（人間が付与する着手許可）/ `auto:in-progress` / `auto:pr-open` / `auto:merge-ready`（`/codex-followup` が付与） / `auto:blocked` / `auto:done`
- **1回の起動で処理するIssueは1件のみ**（worktree・CI・レビュー枠の競合を避けるため）
- ベースブランチは常に `develop`（`main` への直接PRは `restrict-main-merge.yml` で拒否される）
- PRのbaseが `develop` のため、GitHubの `Closes #<N>` は**自動クローズを発火しない**（デフォルトブランチでないと効かない）。Issueクローズは本コマンドが明示的に行う（Step 0）

## 手順

### Step 0. 前回分の後片付け（マージ検知 → Issueクローズ）

新しいIssueを拾う前に、既にPRがマージ済みのものを閉じる。

```powershell
$gh = "C:\Program Files\GitHub CLI\gh.exe"
$prOpenIssues = & $gh issue list --label "auto:pr-open" --state open --json number,body | ConvertFrom-Json
```
- `$LASTEXITCODE -ne 0` → 「Issue一覧取得失敗」と報告し終了
- 各Issueについて、本文またはリンクされたPRから紐づくPR番号を特定する（`pr-submitter` がPR本文に `Closes #<N>` を書く運用のため、`gh pr list --search "<N> in:body"` 等でIssue番号からPRを逆引きする）
- 紐づくPRが見つかり `state == "MERGED"` → `gh issue close <N> --comment "PR #<M> がマージされました"`、ラベルを `auto:pr-open` → `auto:done` に変更
- 見つからない/まだOPEN → 何もしない（`/codex-followup` の管轄なのでここでは触らない）

### Step 1. 対象Issue特定

```powershell
$candidates = & $gh issue list --label "auto-pickup" --state open --json number,title,body,createdAt,labels | ConvertFrom-Json
```
- `$LASTEXITCODE -ne 0` → 取得失敗として終了
- `labels` に `auto:in-progress` / `auto:pr-open` / `auto:blocked` / `auto:done` のいずれかを含むIssueは除外する（＝まだどの状態にも入っていない、純粋に未着手のものだけを残す）
- 残った候補が0件 → 「対象Issueなし」と報告して終了
- 複数件残った場合は `createdAt` が最も古い1件だけを選ぶ

### Step 2. 着手宣言（排他制御）

```powershell
& $gh issue edit <N> --add-label "auto:in-progress"
```
- 失敗した場合（他プロセスが同時に処理を開始した等）は何もせず終了
- 成功後、念のため `gh issue view <N> --json labels` で自分が付けたラベルが確かに付いていることを確認してから次に進む（二重着手防止の最終チェック）

### Step 3. Worktree作成

- `EnterWorktree` でIssue専用の一時worktreeを作る
- ブランチ名: `issue-<N>-<slug>`（`slug` はIssueタイトルから生成。日本語タイトルの場合はローマ字化 or 簡略な英語スラッグに変換する）
- ベースは `develop`

### Step 4. `policy-checker`

- Issueの `目的` / `背景` / `実装方針` セクションを結合したものを「ユーザーの指示」として渡す
- `NEEDS_CONFIRMATION` の場合:
  - `gh issue comment <N>` で衝突箇所を日本語で説明する
  - ラベルを `auto:in-progress` → `auto:blocked` に変更
  - `PushNotification("Issue #<N> は方針衝突のため自動着手不可 — 確認してください")`
  - worktreeを破棄（`ExitWorktree`）して終了
- `OK` の場合 → Step 5へ

### Step 5. TDD実装ループ

1. `test-writer`（Red）
2. `implementer`（Green + Refactor）
3. `code-reviewer`
4. `code-reviewer` が `CHANGES_REQUESTED` → `implementer` に差し戻し、`APPROVED` になるまで反復（内部上限3回）
5. 上限到達で `APPROVED` にならなかった場合:
   - worktreeの変更を破棄（`ExitWorktree`、ブランチは未pushなので何も残らない）
   - ラベルを `auto:in-progress` → `auto:blocked` に変更
   - `gh issue comment <N>` で「自動実装できなかった」旨を日本語で報告
   - `PushNotification("Issue #<N> 自動実装失敗（レビュー規約に収束せず）")`
   - 終了

### Step 6. `pr-submitter`

- 既存の `pr-submitter` エージェントをそのまま呼ぶ（base=`develop`、コミット、push、`gh pr create`、`@codex review Please review in Japanese.` の投稿まで一式）
- **追加指示**: PR本文に `Closes #<N>` を含めるよう `pr-submitter` に伝える（自動クローズは発火しないが、GitHub UI上のIssue⇄PR相互参照として機能させるため。実際のクローズはStep 0で行う）
- PR作成成功後:
  - ラベルを `auto:in-progress` → `auto:pr-open` に変更
  - `gh issue comment <N> --body "PR #<M> を作成しました: <URL>"` で経過を記録

### Step 7. Worktree破棄

- `ExitWorktree` で後片付け（push済みのブランチ自体は残る）

### Step 8. 引き継ぎ

- ここから先（Codexレビュー反復・マージ可否判定・通知）は既存の `/codex-followup` の管轄。本コマンドから追加の呼び出しは行わない
- `/codex-followup` 用のルーティンが「オープンPRでCodexレビュー未完了のもの」を別途巡回する設計にしておけば、本コマンドが作ったPRも自然に拾われる

## 出力フォーマット

```
### 対象Issue
- #<N> <title>（該当なしの場合は「対象Issueなし」で終了）

### Step 0（後片付け）
- クローズしたIssue: <件数>件

### 判定
[方針OK→実装続行 | NEEDS_CONFIRMATION→blocked | 対象なし→終了]

### 実装結果（Step 5まで進んだ場合）
- TDDループ反復回数: <N>/3
- 結果: [APPROVED→PR作成 | 上限到達→blocked]

### PR（作成した場合）
- URL: <PR URL>

### 次のステップ
[/codex-followup に引き継ぎ | ユーザー確認待ち（blocked） | 終了（対象なし）]
```

## やってはいけないこと

- `auto-pickup` ラベルが無いIssueに着手しない
- 同一起動で2件以上のIssueを並行処理しない
- `policy-checker` が `NEEDS_CONFIRMATION` を出したのに実装を続行しない
- `code-reviewer` が `APPROVED` を出す前に `pr-submitter` を呼ばない
- レビュー反復の内部上限（3回）を超えて `implementer` ⇄ `code-reviewer` を回し続けない
- `main` への直接コミット・直接PRをしない（base は常に `develop`）
- worktreeで作った未承認の変更を破棄せずに残さない（`auto:blocked` になったら必ず `ExitWorktree` で片付ける）
- Step 0の後片付けで、`auto:pr-open` のPRがまだOPENなのに `auto:done` に進めない（`/codex-followup` の管轄を横取りしない）
