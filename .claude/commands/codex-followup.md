---
description: 現在ブランチの PR に付いた Codex レビューを 1 反復処理する。`/loop /codex-followup` で反復実行できる。
---

# codex-followup

現在ブランチの PR に対して Codex レビューを **1 反復** 処理する。`/loop /codex-followup`（動的ペース）または `/loop 5m /codex-followup`（5分固定）で反復実行する。

## 前提

- Codex はユーザー名 `chatgpt-codex-connector[bot]` で GitHub に投稿する
- Codex の投稿は **3 系統** ある。全て取得して時系列統合すること:
  - **Issue コメント**: `GET /repos/{o}/{r}/issues/{n}/comments`
  - **PR レビュー本文**: `GET /repos/{o}/{r}/pulls/{n}/reviews`（timestamp は `submitted_at`）
  - **PR インラインコメント**: `GET /repos/{o}/{r}/pulls/{n}/comments`
- gh CLI は `"C:\Program Files\GitHub CLI\gh.exe"` を PowerShell から呼ぶ
- **`gh api` は `--paginate --jq '.[]'` の組で使う**（`--paginate` 単体だと複数ページが別 JSON として連結されて ConvertFrom-Json がパース失敗するため、`--jq '.[]'` で行単位ストリームに変換）
- 反復ごとに 1 コミット以下、原則 3 反復以内で完了

## 手順

### 1. PR & 作者特定
```powershell
$pr = & "C:\Program Files\GitHub CLI\gh.exe" pr view --json number,url,state,author,title | ConvertFrom-Json
$author = $pr.author.login
```
- `state != "OPEN"` → 「PR 無し / MERGED / CLOSED のため終了」と報告し、**ScheduleWakeup を呼ばない**

### 2. コメント履歴取得（3 系統、全ページ、行単位ストリーム）
```powershell
$issueComments  = & "C:\Program Files\GitHub CLI\gh.exe" api --paginate repos/{o}/{r}/issues/{n}/comments  --jq '.[]' | ForEach-Object { $_ | ConvertFrom-Json }
$reviews        = & "C:\Program Files\GitHub CLI\gh.exe" api --paginate repos/{o}/{r}/pulls/{n}/reviews   --jq '.[]' | ForEach-Object { $_ | ConvertFrom-Json }
$reviewComments = & "C:\Program Files\GitHub CLI\gh.exe" api --paginate repos/{o}/{r}/pulls/{n}/comments  --jq '.[]' | ForEach-Object { $_ | ConvertFrom-Json }
```
- **iteration marker**: `issueComments` のうち `user.login == $author` かつ `body` に `@codex review` を含むもの
- **Codex 投稿**: 3 系統から `user.login == "chatgpt-codex-connector[bot]"` を集めて `created_at` / `submitted_at` で時系列統合

### 3. iteration marker 有無チェック
- marker が 0 個 → 「@codex review 未依頼のため終了」と報告し、**ScheduleWakeup を呼ばない**
- marker >= 1 → **ステップ 4** で最新依頼への応答を必ず処理する（反復上限はここでは適用しない）

### 4. Codex 最新レスポンス判定
- 最後の iteration marker より **後** に投稿された Codex 投稿を全て収集
- 各投稿について **「PR 作者が付けた 👍 リアクション」** の有無をチェックし、有なら「処理済み」として除外:
  ```powershell
  # Issue コメントの reactions
  $rx = & "C:\Program Files\GitHub CLI\gh.exe" api repos/{o}/{r}/issues/comments/<cid>/reactions --jq '.[]' | ForEach-Object { $_ | ConvertFrom-Json }
  # PR インラインコメントの reactions
  $rx = & "C:\Program Files\GitHub CLI\gh.exe" api repos/{o}/{r}/pulls/comments/<cid>/reactions --jq '.[]' | ForEach-Object { $_ | ConvertFrom-Json }
  $processed = @($rx | Where-Object { $_.content -eq "+1" -and $_.user.login -eq $author }).Count -gt 0
  ```
  （他ユーザーの 👍 は「有用」の意思表示で処理済みとは限らないので除外条件に含めない）
- **未処理が 0 件** → 「Codex 未レビュー / レビュー中」と報告、**300 秒後に ScheduleWakeup**
- **未処理あり** → 内容判定:
  - 全てが LGTM 系（例: `Didn't find any major issues` / `LGTM` / `You're on a roll` / `Approved` / `問題ありません`）のみ → **ステップ 4.5**（マージ可能チェック）
  - 具体的な指摘あり → **ステップ 5**

### 4.5. マージ可能チェック & 通知
```powershell
$m = & "C:\Program Files\GitHub CLI\gh.exe" pr view <num> --json mergeable,mergeStateStatus,statusCheckRollup,title | ConvertFrom-Json
```

**判定順（この順序を守る）**:

1. **CI の pending 判定を先に行う**:
   - CheckRun で `status != "COMPLETED"` あり（`IN_PROGRESS` / `QUEUED` / `WAITING` / `PENDING` / `REQUESTED` すべてを含む）
   - または StatusContext で `state == "pending"` あり
   - → 「CI 走行中」と報告、**通知せず 120 秒後に ScheduleWakeup**

2. **CI の失敗判定**:
   - CheckRun で `conclusion in {"FAILURE", "CANCELLED", "TIMED_OUT", "STARTUP_FAILURE", "ACTION_REQUIRED"}` あり
   - または StatusContext で `state in {"failure", "error"}` あり
   - → `PushNotification("PR #<num> Codex approved but CI failed — <title>")`、終了

3. **CI 全成功後、mergeStateStatus と mergeable を確認**:
   - `mergeable == "MERGEABLE"` かつ **`mergeStateStatus == "CLEAN"`** → `PushNotification("PR #<num> merge ready — <title>")`、「MERGE READY」報告、**ScheduleWakeup を呼ばない**
   - `mergeable == "CONFLICTING"` → `PushNotification("PR #<num> Codex approved but merge conflict — <title>")`、「マージコンフリクト」報告、**ScheduleWakeup を呼ばない**
   - `mergeable == "UNKNOWN"` → GitHub 計算中の一時状態。**通知しない**、**60 秒後に ScheduleWakeup**
   - `mergeStateStatus` がその他（`DRAFT` / `BLOCKED` / `BEHIND` / `DIRTY` / `UNSTABLE` 等）→ `PushNotification("PR #<num> ready except mergeStateStatus=<X> — needs manual review")`、その状態を報告して終了（ScheduleWakeup しない）
     - `DRAFT`: Draft PR。ready for review にする必要あり
     - `BLOCKED`: 必須承認不足 / 未解決レビュースレッド
     - `BEHIND`: ベースブランチが進んでいる。update ブランチ推奨
     - `DIRTY`: コンフリクト（本来 `mergeable=="CONFLICTING"` と重なる）
     - `UNSTABLE`: 非必須 check が失敗

### 5. 指摘への対応

各未処理 Codex 投稿を分類して処理:

- **コード修正が必要**:
  - `policy-checker` サブエージェントで CLAUDE.md / decisions.md との衝突を確認
  - 衝突あり → 修正せず `gh pr comment <num> --body "..."` で理由を日本語で返信 → その Codex コメントに **PR 作者アカウントで** 👍 リアクション追加
  - 衝突なし → `implementer` → `code-reviewer` サブエージェントで修正 → 現ブランチにコミット + push
- **意見・質問系（コード変更不要）**:
  - `gh pr comment <num> --body "..."` で日本語で返信
  - 返信対象の Codex コメントに **PR 作者アカウントで** 👍 リアクション追加

**リアクション付与コマンド**（gh の認証ユーザーで実行される）:
```powershell
# Issue コメント
& "C:\Program Files\GitHub CLI\gh.exe" api -X POST repos/{o}/{r}/issues/comments/<cid>/reactions -f content=+1
# PR インラインコメント
& "C:\Program Files\GitHub CLI\gh.exe" api -X POST repos/{o}/{r}/pulls/comments/<cid>/reactions -f content=+1
```
※ `gh auth status` の認証ユーザーが PR 作者と一致していることを想定。gh の認証ユーザーが違う場合は「処理済みマーカー」ロジックが動かないため、authenticated user を先に確認して `$author` と比較する。

### 6. 反復上限チェック & 再レビュー依頼
- **実コード修正が入った場合**:
  - 既存の iteration marker が >= 3 個なら「反復上限（3 回）に達したので追加依頼はせず終了」と報告
  - そうでなければ `gh pr comment <num> --body "@codex review Please review in Japanese."` を投稿（= 新しい marker）
- **返信のみで済んだ場合**: 再依頼しない

### 7. 次の wakeup
- ステップ 6 で新しい marker を投稿した → **300 秒後に ScheduleWakeup**（Codex レビュー完了を待つ）
- 返信のみで完了 → 👍 リアクションで再検出は防止済み。**ScheduleWakeup を呼ばない**（「返信完了」で終了）
- ステップ 4.5 のマージ可能チェック結果に従う

## 出力フォーマット

```
### 反復 <M>/3 (PR #<num>) — <title>
- URL: <PR URL>
- 未処理 Codex 応答: <N 件>（指摘 X / LGTM Y）
- 対応: [修正 <F> ファイル push / 返信 <R> 件 / 対応なし]
- 次回: [<S> 秒後に wakeup 予約 / 終了 (<理由>)]
```

## やってはいけないこと

- CLAUDE.md / docs/decisions.md の規約に反する変更を Codex 指摘に従って入れない（変更せず理由を返信して 👍 リアクション）
- 元の PR 目的から外れる新機能追加を「ついでに」やらない（別 PR にする）
- 反復上限を超えて **新たな iteration marker を投稿** しない（既存 marker の応答処理は続行する）
- Codex がまだレビュー中に催促・再依頼しない（wakeup を待つ）
- `iteration marker 0 個`（未依頼）と `marker >= 1 かつ Codex 応答なし`（レビュー待ち）を混同しない — 前者は終了、後者は wakeup
- `mergeable == "UNKNOWN"` を競合として通知しない（GitHub 計算中の一時状態）
- `mergeable == "MERGEABLE"` だけで MERGE READY 通知しない — `mergeStateStatus == "CLEAN"` を必ず併せて確認
- CI が pending の間に MERGE READY を通知しない（`status != "COMPLETED"` を先に検出）
- `gh api` を `--paginate --jq '.[]'` の組み合わせなしで呼ばない
- 「👍 リアクションあり」を投稿者に関わらず処理済み扱いしない（PR 作者アカウントの 👍 のみを処理済みマーカーとする）
- 返信のみで済んだ Codex コメントに 👍 リアクションを忘れると次回同じ返信を投稿する