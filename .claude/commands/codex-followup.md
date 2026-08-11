---
description: 現在ブランチの PR に付いた Codex レビューを 1 反復処理する。`/loop /codex-followup` で反復実行できる。
---

# codex-followup

現在ブランチの PR に対して Codex レビューを **1 反復** 処理する。`/loop /codex-followup`（動的ペース）または `/loop 5m /codex-followup`（5分固定）で反復実行する。

## 前提

- Codex はユーザー名 `chatgpt-codex-connector[bot]` で GitHub に投稿する
- Codex の投稿は **3 系統** ある。役割が違うので分けて扱う:
  - **Issue コメント**: `GET /repos/{owner}/{repo}/issues/$($pr.number)/comments`
    - 実際の指摘 / 質問 / 応答が入る（`@codex address` 等）
    - Reactions API あり（`/issues/comments/<cid>/reactions`）→ 処理済み専用の 👀 マーカー可
  - **PR レビュー本文**: `GET /repos/{owner}/{repo}/pulls/$($pr.number)/reviews`（timestamp は `submitted_at`）
    - **本文はラッパーテキスト**（`Here are some automated review suggestions` / `Didn't find any major issues` など）
    - 実際の指摘は含まれず、承認判定 (`state == "APPROVED"` or LGTM 文言) にのみ使う
    - **Reactions API は無い** → 個別の処理済みマーカー不要（承認判定用のみ）
  - **PR インラインコメント**: `GET /repos/{owner}/{repo}/pulls/$($pr.number)/comments`
    - コード行への指摘が入る（Codex の主な指摘手段）
    - Reactions API あり（`/pulls/comments/<cid>/reactions`）→ 処理済み専用の 👀 マーカー可
- gh CLI は `"C:\Program Files\GitHub CLI\gh.exe"` を PowerShell から呼ぶ
- **`gh api` は `--paginate --jq '.[]'` の組で使う**（コメント履歴・リアクション両方）。URL テンプレート内では `{owner}` `{repo}` のみ gh が自動展開し、PR 番号は自動展開されないので明示的に埋め込む（PowerShell の場合は `$($pr.number)`）
- 反復ごとに 1 コミット以下、原則 3 反復以内で完了

## 手順

### 1. PR & 作者特定
```powershell
$prJson = & "C:\Program Files\GitHub CLI\gh.exe" pr view --json number,url,state,author,title
if ($LASTEXITCODE -ne 0) { throw "pr view 取得失敗 (exit=$LASTEXITCODE)" }
$pr = $prJson | ConvertFrom-Json
$author = $pr.author.login
$iterationRequest = "@codex review Please review in Japanese."
$viewer = & "C:\Program Files\GitHub CLI\gh.exe" api user --jq .login
if ($LASTEXITCODE -ne 0) { throw "gh 認証ユーザー取得失敗 (exit=$LASTEXITCODE)" }
```
- **`$LASTEXITCODE != 0`（一時障害）** → 「PR 取得失敗のため再取得予約」と報告し、**300 秒後に ScheduleWakeup**（分類・通知に進まない）
- `state != "OPEN"` → 「PR 無し / MERGED / CLOSED のため終了」と報告し、**ScheduleWakeup を呼ばない**
- `$viewer -ne $author` → 「gh 認証ユーザーが PR 作者と異なるため終了」と報告し、**ScheduleWakeup を呼ばない**。リアクションと iteration marker は PR 作者アカウントで投稿・判定するため、共同作業者の認証では実行しない

### 2. コメント履歴取得（3 系統、全ページ、行単位ストリーム）
```powershell
$issueComments  = & "C:\Program Files\GitHub CLI\gh.exe" api --paginate "repos/{owner}/{repo}/issues/$($pr.number)/comments"  --jq '.[]' | ForEach-Object { $_ | ConvertFrom-Json }
if ($LASTEXITCODE -ne 0) { throw "issue comments 取得失敗 (exit=$LASTEXITCODE)" }
$reviews        = & "C:\Program Files\GitHub CLI\gh.exe" api --paginate "repos/{owner}/{repo}/pulls/$($pr.number)/reviews"   --jq '.[]' | ForEach-Object { $_ | ConvertFrom-Json }
if ($LASTEXITCODE -ne 0) { throw "reviews 取得失敗 (exit=$LASTEXITCODE)" }
$reviewComments = & "C:\Program Files\GitHub CLI\gh.exe" api --paginate "repos/{owner}/{repo}/pulls/$($pr.number)/comments"  --jq '.[]' | ForEach-Object { $_ | ConvertFrom-Json }
if ($LASTEXITCODE -ne 0) { throw "review comments 取得失敗 (exit=$LASTEXITCODE)" }
```
- **いずれかの取得で `$LASTEXITCODE != 0`** → 「取得失敗のためこの反復をスキップ」と報告し、**300 秒後に ScheduleWakeup で再取得**（分類・通知に進まない）
- **iteration marker**: `issueComments` のうち `user.login == $author` かつ `body.Trim() -eq $iterationRequest` のもの。説明文中に `@codex review` を含む返信は marker にしない
- **Codex 投稿の分類**:
  - Issue コメント (Codex): `issueComments` から `user.login == "chatgpt-codex-connector[bot]"`（処理済み判定あり）
  - Review 本文: `reviews` から `user.login == "chatgpt-codex-connector[bot]"`（承認判定のみ）
  - インラインコメント: `reviewComments` から `user.login == "chatgpt-codex-connector[bot]"`（処理済み判定あり）

### 3. iteration marker 有無チェック
- marker が 0 個 → 「@codex review 未依頼のため終了」と報告し、**ScheduleWakeup を呼ばない**
- marker >= 1 → **ステップ 4** で最新依頼への応答を必ず処理する（反復上限はここでは適用しない）

### 4. Codex 最新レスポンス判定
最後の iteration marker より **後** に投稿された Codex 投稿を分類する。

**A. 承認判定（review 本文 + issue コメントから）**:
- `reviews.state == "APPROVED"` のみ → LGTM（最も信頼できるシグナル）
- または本文全体をトリムした結果が既知の LGTM メッセージに **完全一致** するもの → LGTM
  - 完全一致リスト: `Didn't find any major issues. You're on a roll.` / `LGTM` / `LGTM!` / `👍` / `Approved` / `問題ありません`
  - 部分一致は使わない（`Not Approved: ...` のような否定文が誤マッチするため）
- 上記のうち承認シグナルが 1 つでもあれば「Codex 承認」

**B. 指摘の収集（issue コメント + インラインコメントから）**:
- Issue コメントで PR 作者による **👀（`eyes`）** リアクションが付いていないもの
- インラインコメントで PR 作者による **👀（`eyes`）** リアクションが付いていないもの
- **A で承認応答として分類した Issue コメントは B から除外する**（そうしないと LGTM が「指摘」として再検出され、マージ可能チェックに進まなくなる）
- **PR 作者による 👀 の判定** — リアクション自体もページング対象、失敗検査必須:
  ```powershell
  $rx = & "C:\Program Files\GitHub CLI\gh.exe" api --paginate "repos/{owner}/{repo}/issues/comments/<cid>/reactions" --jq '.[]' | ForEach-Object { $_ | ConvertFrom-Json }
  if ($LASTEXITCODE -ne 0) { throw "reactions 取得失敗 (exit=$LASTEXITCODE)" }
  # PR インラインコメントの場合は /pulls/comments/<cid>/reactions
  $processed = @($rx | Where-Object { $_.content -eq "eyes" -and $_.user.login -eq $author }).Count -gt 0
  ```
  👍 は Codex の「Useful?」への評価にも使われるため処理済み判定には使わない。👀 はこのコマンド専用の処理済みマーカーとし、他ユーザーの 👀 も除外条件に含めない
- **リアクション取得で `$LASTEXITCODE != 0`** → 分類・返信・通知に進まず「取得失敗のため再取得予約」と報告、**300 秒後に ScheduleWakeup**（既に 👀 済みのコメントを未処理と誤判定しないため）

**C. Review 本文の扱い**:
- `body` が空、または「automated review suggestions」等のラッパーテキストのみ → **スキップ**（実際の指摘はインラインコメント側に入っている）
- Reactions API が無いので個別に処理済みマーカーは付けない（承認判定用途のみ）

**判定結果ごとの遷移**:
- 未処理指摘（B）が 0 件 かつ 承認シグナル（A）あり → **ステップ 4.5**（マージ可能チェック）
- 未処理指摘（B）が 0 件 かつ 承認シグナル無し → 「Codex 未レビュー / レビュー中」と報告、**300 秒後に ScheduleWakeup**
- 未処理指摘（B）あり → **ステップ 5**

### 4.5. マージ可能チェック & 通知
```powershell
$mJson = & "C:\Program Files\GitHub CLI\gh.exe" pr view <num> --json mergeable,mergeStateStatus,statusCheckRollup,title
if ($LASTEXITCODE -ne 0) { throw "pr view (merge status) 取得失敗 (exit=$LASTEXITCODE)" }
$m = $mJson | ConvertFrom-Json
```
- **`$LASTEXITCODE != 0`** → 通知せず「取得失敗」と報告、**120 秒後に ScheduleWakeup**（空データで CI 判定・通知に進まない）

**判定順（この順序を守る）**:

1. **CI の pending 判定を先に行う**:
   - CheckRun で `status != "COMPLETED"` あり（`IN_PROGRESS` / `QUEUED` / `WAITING` / `PENDING` / `REQUESTED` すべて含む）
   - または StatusContext で `state in {"PENDING", "EXPECTED"}` あり（GraphQL enum は大文字。`EXPECTED` は必須 check がまだ報告前の状態）
   - → 「CI 走行中」と報告、**通知せず 120 秒後に ScheduleWakeup**

2. **CI の失敗判定**:
   - CheckRun で `conclusion in {"FAILURE", "CANCELLED", "TIMED_OUT", "STARTUP_FAILURE", "ACTION_REQUIRED"}` あり
   - または StatusContext で `state in {"FAILURE", "ERROR"}` あり（GraphQL enum は大文字）
   - → `PushNotification("PR #<num> Codex approved but CI failed — <title>")`、終了

3. **CI 全成功後、mergeStateStatus と mergeable を確認**:
   - `mergeable == "MERGEABLE"` かつ **`mergeStateStatus == "CLEAN"`** → `PushNotification("PR #<num> merge ready — <title>")`、「MERGE READY」報告、**ScheduleWakeup を呼ばない**
   - `mergeable == "CONFLICTING"` → `PushNotification("PR #<num> Codex approved but merge conflict — <title>")`、「マージコンフリクト」報告、**ScheduleWakeup を呼ばない**
   - `mergeable == "UNKNOWN"` → GitHub 計算中。**通知しない**、**60 秒後に ScheduleWakeup**
   - `mergeStateStatus` がその他（`DRAFT` / `BLOCKED` / `BEHIND` / `DIRTY` / `UNSTABLE` 等）→ `PushNotification("PR #<num> ready except mergeStateStatus=<X> — needs manual review")`、報告して終了

**MERGE READY 時の Issue ラベル遷移（`/issue-picker` 由来のPRのみ該当）**:
- PR本文に `Closes #<N>` の記載があるか確認する
- 記載がある場合、その Issue に `auto:pr-open` ラベルが付いていれば `gh issue edit <N> --remove-label "auto:pr-open" --add-label "auto:merge-ready"` で遷移させる（`/issue-picker` の Step 0 が `auto:merge-ready` も検索対象にしているため、この遷移を怠るとマージ後にIssueが `auto:done` にならず放置される）
- `Closes #<N>` の記載が無い場合（`/issue-picker` 経由ではない通常のPR）は何もしない

### 5. 指摘への対応

各未処理指摘（issue コメント + インラインコメント）を分類して処理:

- **コード修正が必要**:
  - `policy-checker` サブエージェントで CLAUDE.md / decisions.md との衝突を確認
  - 衝突あり → 修正せず `gh pr comment <num> --body "..."` で理由を日本語で返信 → その Codex コメントに **PR 作者アカウントで** 👀 リアクション追加
  - 衝突なし → **指摘のカテゴリ判定**（下表）を行い、対応するコンテキストを付与した上で この指摘専用の一時 worktree で **`test-writer` (Red)** → **`implementer` (Green + Refactor)** → **`code-reviewer`** の順でサブエージェントを呼ぶ。`APPROVED` になった変更だけを現ブランチへコミット + push する
    - CLAUDE.md の TDD 規約に従い、test-writer をスキップしない（`implementer` は失敗テストが存在することを前提としている）
    - `code-reviewer` が **`CHANGES_REQUESTED`** を返した場合は **`APPROVED` になるまで `implementer` → `code-reviewer` を反復する**（CLAUDE.md サブエージェント運用フロー準拠）。反復回数の内部上限は 3 とし、超えた場合は一時 worktree を破棄して未承認の変更を残さず、Codex に「規約違反で自動修正できない」と返信して 👀
    - `APPROVED` を得たら一時 worktree の承認済み変更だけを現ブランチにコミット + push
  - **コード修正後もその Codex コメントに PR 作者アカウントで 👀 リアクションを追加**（上限到達で新しい marker を投稿できない場合や、Codex の再レビューが同じ指摘を再掲した場合に、二重処理を防ぐため）

**指摘カテゴリ判定**（専用エージェントは作らず、`implementer`/`test-writer` 呼び出し時のプロンプトに追加コンテキストとして注入する。理由: 規約チェック自体は `code-reviewer.md` の観点表に集約済みで全カテゴリ共通のため、エージェントを分けると重複する）:

| カテゴリ | 判定キーワード例 | 追加で参照させるドキュメント | 重点確認事項 |
|---------|-----------------|---------------------------|-------------|
| UI/デザイン | レイアウト、CSS、コンポーネント分割、トンマナ、アクセシビリティ、レスポンシブ | `docs/design-tone-and-manner.md`、`src/components/` 配置規約（CLAUDE.md） | 子供画面/親画面のトンマナ差、500行超のページはフォーム/モーダル抽出を検討したか |
| ロジック/パフォーマンス | N+1、計算量、非効率なクエリ、リファクタ、集約ロジック逸脱 | `src/lib/` モジュール分割規約、XP・進化ロジックのインポート先表（CLAUDE.md） | `approve.ts`/`evolution.ts`/`xp.ts` 経由になっているか、手書きロジックで規約を再実装していないか |
| QA/テスト・型・バグ | テスト不足、型エラー、境界値漏れ、ステータス遷移違反 | CLAUDE.md ステータス遷移表、`src/__tests__/` 命名規約 | 境界値テストの有無、`getUTCDay()` 等の日付規約違反 |

- どのカテゴリにも明確に当てはまらない/複数カテゴリにまたがりどちらか判断に迷う指摘は「QA/テスト・型・バグ」寄りに倒す（安全側: テストで担保されていれば誤修正のリスクが下がるため）
- QAカテゴリでテスト不足が明確な指摘のみ `test-writer` に「既存テストへの追加」であることを明示する。UI/ロジックカテゴリでは既存テストの Green 維持確認で足りることが多い
- **意見・質問系（コード変更不要）**:
  - `gh pr comment <num> --body "..."` で日本語で返信
  - 返信対象の Codex コメントに **PR 作者アカウントで** 👀 リアクション追加

**リアクション付与コマンド**（gh の認証ユーザーで実行される）:
```powershell
# Issue コメント（👀 は処理済み専用マーカー。👍 は有用性評価に使われるため使用しない）
& "C:\Program Files\GitHub CLI\gh.exe" api -X POST "repos/{owner}/{repo}/issues/comments/<cid>/reactions" -f content=eyes
# PR インラインコメント
& "C:\Program Files\GitHub CLI\gh.exe" api -X POST "repos/{owner}/{repo}/pulls/comments/<cid>/reactions" -f content=eyes
```
※ 開始時に gh 認証ユーザーが `$author` と一致することを必ず検証する。不一致ならこのコマンドは終了する

### 6. 反復上限チェック & 再レビュー依頼
- **実コード修正が入った場合**:
  - 既存の iteration marker が >= 3 個なら「反復上限（3 回）に達したので追加依頼はせず終了」と報告
  - そうでなければ `gh pr comment <num> --body "@codex review Please review in Japanese."` を投稿（= 新しい marker）
- **返信のみで済んだ場合**: 再依頼しない

### 7. 次の wakeup
- ステップ 6 で新しい marker を投稿した → **300 秒後に ScheduleWakeup**（Codex レビュー完了を待つ）
- 返信のみで完了し、未処理指摘が 0 件かつ既存の承認シグナル（ステップ 4-A）がある → **ステップ 4.5** に進み、マージ可能チェックを実行する
- 返信のみで完了し、承認シグナルがない → 👀 リアクションで再検出防止済み。**ScheduleWakeup を呼ばない**（「返信完了」で終了）
- ステップ 4.5 のマージ可能チェック結果に従う

## 出力フォーマット

```
### 反復 <M>/3 (PR #<num>) — <title>
- URL: <PR URL>
- 未処理 Codex 指摘: <N 件>（issue X / inline Y）承認シグナル: [有/無]
- 対応: [修正 <F> ファイル push / 返信 <R> 件 / 対応なし]
- 次回: [<S> 秒後に wakeup 予約 / 終了 (<理由>)]
```

## やってはいけないこと

- CLAUDE.md / docs/decisions.md の規約に反する変更を Codex 指摘に従って入れない（変更せず理由を返信して 👀 リアクション）
- 元の PR 目的から外れる新機能追加を「ついでに」やらない（別 PR にする）
- 反復上限を超えて **新たな iteration marker を投稿** しない（既存 marker の応答処理は続行する）
- Codex がまだレビュー中に催促・再依頼しない（wakeup を待つ）
- `iteration marker 0 個`（未依頼）と `marker >= 1 かつ Codex 応答なし`（レビュー待ち）を混同しない — 前者は終了、後者は wakeup
- **Review 本文（`/pulls/<PR番号>/reviews`）を「指摘」として処理しない** — 本文はラッパーテキストなので承認判定のみに使う
- **空の review 本文を「指摘あり」に分類しない** — インライン側に本体があるだけ
- `mergeable == "UNKNOWN"` を競合として通知しない（GitHub 計算中の一時状態）
- `mergeable == "MERGEABLE"` だけで MERGE READY 通知しない — `mergeStateStatus == "CLEAN"` を必ず併せて確認
- CI が pending の間に MERGE READY を通知しない（`status != "COMPLETED"` を先に検出）
- `gh api` を **コメント履歴もリアクションも** `--paginate --jq '.[]'` の組み合わせなしで呼ばない
- 「👀 リアクションあり」を投稿者に関わらず処理済み扱いしない（PR 作者アカウントの 👀 のみ）。👍 は通常の有用性評価であり処理済み判定に使わない
- 返信のみで済んだ Codex コメントに 👀 リアクションを忘れると次回同じ返信を投稿する
- 内部レビューが上限に達した変更を現ブランチへ残さない。一時 worktree を破棄し、承認済みの変更だけを取り込む
