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
- 反復ごとに 1 コミット以下、原則 20 反復以内で完了

## 手順

### 1. PR & 作者特定
- **PR番号は「このコマンドを呼び出した指示の中で明示的に名指しされているか」で決める**（PowerShellの関数引数のように自動的に渡される変数ではない。例えば `/issue-picker` のStep 8は「PR #<M> についてcodex-followupを実行する」のように呼び出し側の指示文でPR番号を明示すること。呼び出し指示にPR番号が無い場合のみ、現在のブランチから `gh pr view` で解決する）
```powershell
$prJson = if ($prNumber) {  # $prNumber は呼び出し指示で明示された場合のみ設定されている
  & "C:\Program Files\GitHub CLI\gh.exe" pr view $prNumber --json number,url,state,author,title,headRefName
} else {
  & "C:\Program Files\GitHub CLI\gh.exe" pr view --json number,url,state,author,title,headRefName
}
if ($LASTEXITCODE -ne 0) { throw "pr view 取得失敗 (exit=$LASTEXITCODE)" }
$pr = $prJson | ConvertFrom-Json
$author = $pr.author.login
$headBranch = $pr.headRefName
$iterationRequest = @"
@codex review Please review in Japanese.

【ルール】
1. 動作不能になるバグ（Fatal Bug）、または明確なセキュリティ脆弱性のみ指摘してください。
2. コードスタイル、可読性、型定義の厳密化、パフォーマンスの極小な改善などの「些細な指摘」は一切出さないでください。
3. 指摘事項がある場合は、重要度が高い順に「最大3件まで」に絞って簡潔に教えてください。
4. 致命的な問題がない場合は、シンプルに「LGTM」とだけ返答してください。
"@
$viewer = & "C:\Program Files\GitHub CLI\gh.exe" api user --jq .login
if ($LASTEXITCODE -ne 0) { throw "gh 認証ユーザー取得失敗 (exit=$LASTEXITCODE)" }
```
- **`$headBranch`（PRのheadブランチ）を必ず控えておく**。Step 5でコード修正をコミット・pushする際、呼び出し元の「現在のブランチ」ではなく必ずこの `$headBranch` を対象にする（`/issue-picker` はworktreeを破棄済みの状態からこのコマンドを呼ぶため、現在ブランチは呼び出し元の `main` や別のfeatureブランチのままで、PRのheadブランチとは無関係）
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
- **iteration marker**: `issueComments` のうち `user.login == $author` かつ `body.Trim().StartsWith("@codex review")` のもの（完全一致ではなく前方一致にする。依頼文に指摘の粒度を絞る指示文などを追記して変更しても、marker検出ロジック側を毎回同期する必要がなくなる）。ただし本文中に `@codex review` という語句が途中に出てくるだけの説明的な返信（例:「まだ@codex reviewを再依頼していません」）は、文頭に無い限り marker にしない
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
  - 衝突なし → **指摘のカテゴリ判定**（下表）を行い、対応するコンテキストを付与した上で **`$headBranch` 上で** **`test-writer` (Red)** → **`implementer` (Green + Refactor)** → **`code-reviewer`** の順でサブエージェントを呼ぶ（コミット・pushのタイミングは後述）
    - **対象が `.gitignore`・`docs/`・`.claude/agents/*.md`・`.claude/commands/*.md` 等、関数・モジュール・APIを持たないドキュメント/設定ファイルのみの指摘の場合、`test-writer` は呼ばず `implementer` → `code-reviewer` のみで進める**（`implementer`/`code-reviewer` 双方に「テスト対象外モード」があるので、そちらを使うよう呼び出し時に明示する）。判定に迷う場合は通常通り `test-writer` を呼ぶ側に倒す

    **作業場所の決め方（この反復で処理する全指摘に共通、指摘ごとに作り直さない）**:
    - まず `git fetch origin $headBranch` で `$headBranch` の最新状態を取得する（**ローカルの `$headBranch` がリモートより古い可能性があるため必須**。古いコミット上に修正を積むと push が non-fast-forward になり、再実行しても解消しない）
    - **経路A/Bを判定する前に、ローカルの `$headBranch` が `origin/$headBranch` より進んでいないか確認する**（前回の反復で最終pushが失敗し、コミットだけがローカルに残っている可能性がある。ローカルブランチの参照はworktreeを破棄しても残るため、前回そのpush失敗の直後に `ExitWorktree` していても問題なく検出できる）。進んでいる場合は、まず `git rev-list --count "origin/$headBranch..$headBranch"` が **1** であることを確認し、その1コミットのメッセージを `git log -1 --format=%B $headBranch` で取得する。件名が下記の固定値 `fix(review): address Codex feedback` と完全一致し、本文に1個以上ある `Codex-Comment-ID: <数値ID>` trailer の全IDが、Step 4-Bで今回取得した「PR作者の 👀 がまだ無い未処理Codexコメント」のIDに含まれる場合に限り、**このコマンド自身が前回生成した未送信コミット**と認定する。aheadが2コミット以上、件名不一致、trailer無し・重複・数値以外、または処理済み/現在取得できないIDが1つでもある場合は、ユーザー作成コミットの混入または状態不明として**自動pushも経路Bの `-B` も行わず**、対象SHAと検証失敗理由を報告し `PushNotification("PR #<num> $headBranch にpush待ちの未識別コミットがあり自動処理を停止 — 確認してください")` を呼んでからScheduleWakeupを呼ばず終了する（人間の手動コミットが混ざっている可能性があるため、通知せず黙って止まると誰にも気づかれない）
    - 上記検証をすべて通過した1コミットだけを、新しい指摘の処理や経路Bの `-B` によるリセット（下記）に進む**前に** `git push origin $headBranch:$headBranch` で再送する（**リポジトリ内のどのディレクトリから実行しても対象を一意にするため、必ず `<ローカル>:<リモート>` の完全な refspec を明示する**。単なる `git push` は「現在チェックアウトしているブランチ」に依存するため使わない）。push終了コードが0でも、`git ls-remote --exit-code --heads origin $headBranch` のSHAが `git rev-parse $headBranch` と一致することを確認できるまでは成功扱いにしない。反映を確認できた場合だけtrailer内の各コメントIDに 👀 を付け、この反復の新しい指摘の処理に進む。**この再送成功は、この反復で新規に処理した指摘が0件であっても、必ずStep 6の「実コード修正が入った場合」として扱う**（前回の反復で承認された修正がこの時点で初めてPRに反映されるため。ここで扱いを曖昧にすると、新規指摘が無い反復は「返信のみで済んだ場合」に誤分類され、未レビューの修正をpushしたままCodexへの再依頼もwakeupの予約もされずに停止する）。**再試行または反映確認に失敗した場合は、経路Bの `-B` によるリセットを絶対に実行しない**（`-B` はローカルブランチを強制的に `origin/$headBranch` へ巻き戻すため、まだpushできていない承認済みコミットが失われる）。新しい指摘の処理はせず、失敗を報告して120秒後にScheduleWakeup
    - 現在のブランチが既に `$headBranch` である場合（`gh pr view` を引数無しで解決した通常運用のケース。このコマンドを反復実行してきたこのセッション自体がこれに該当する）→ **経路A**: 現在の作業ディレクトリで直接作業する。`git status --porcelain` がクリーンな状態で、ローカルの `$headBranch` が `origin/$headBranch` より古ければ `git merge --ff-only origin/$headBranch`（このブランチはPRのhead以外の用途に使わないため、fast-forwardできないということは通常起きないはずだが、できない場合はそれ自体を異常として報告し終了する）
    - 異なる場合（`/issue-picker` からPR番号を明示されて呼ばれ、worktreeを破棄済みのケース）→ **経路B**: 直前の「pushの再試行」が無かった、または成功した後にのみ、この反復の**最初のコード修正指摘の処理を始める時に一度だけ** `git worktree add <path> -B $headBranch origin/$headBranch` で一時worktreeを作る。`-B` はローカルの `$headBranch` を `origin/$headBranch` の最新状態にリセットしてからチェックアウトする（別名の一時ブランチを作ってはいけない。それだと後でpushしても本来の `$headBranch`／PRが更新されない）。この反復で処理する残りの指摘も**同じworktreeを使い回す**（指摘ごとに作り直さない。2件目以降で毎回 `git worktree add` すると、既にそのworktreeが `$headBranch` をチェックアウト済みのため `already used by worktree` で失敗する）。この反復の処理が全て終わったら（成功・失敗を問わず）`ExitWorktree` で破棄してよい（ローカルブランチ参照は残るため、未pushコミットがあっても失われない。次回の「pushの再試行」で回収できる）

    **経路A（現在の作業ディレクトリで直接作業）の追加手順**:
    - 使う前に `git status --porcelain` でクリーンであることを確認する。未コミットの変更が既にある場合（ユーザー自身の作業中の可能性がある）、この反復では自動修正を行わず**反復全体をスキップ**する（「作業ディレクトリに未コミットの変更があるため今回は自動修正を見送り」と報告し、通常通り300秒後にScheduleWakeup。無関係な既存の変更を上書き・巻き込みコミットするリスクを避けるため、個別コメントだけでなく反復全体を止める）

    **指摘単位の隔離（経路A・経路B共通、複数のコード修正指摘を1反復で扱う場合に必須）**:
    - この反復の処理を始める前に `$iterationStartCommit = git rev-parse HEAD` を記録する
    - **各指摘の処理を始める直前**に `$findingCheckpoint = git rev-parse HEAD` を記録する
    - その指摘が `APPROVED` になったら、push はせず**その場でローカルにチェックポイントコミットする**（`git add -A; git commit -m "wip: <指摘の要約> (comment: <その指摘のCodexコメントID>)"`）。チェックポイントはこの反復内の隔離専用であり、そのままpushや次回再送の判定には使わない。これにより後続の指摘の失敗が、この指摘の承認済み変更を巻き込まなくなる
    - その指摘が内部反復上限（3回）に達して失敗したら、`git reset --hard $findingCheckpoint`（この指摘の分の追跡済み変更のみを復元。$findingCheckpoint以前にチェックポイントコミット済みの他の指摘には触れない）**に続けて** `git clean -fd`（この指摘の試行で作られた未追跡ファイルを削除）を実行する
    - **この反復で処理する全指摘が終わったら**、`git rev-parse HEAD` が `$iterationStartCommit` から進んでいれば（＝1件以上APPROVEDになっていれば）、`git reset --soft $iterationStartCommit` で複数のチェックポイントコミットを1つにまとめる。最終コミットは件名を必ず `fix(review): address Codex feedback` とし、空行の後に、含まれる各未処理指摘を `Codex-Comment-ID: <数値ID>` trailerとして1行ずつ重複なく列挙する。その上で1回だけコミットしてからpushする（「反復ごとに1コミット以下」の原則を守るため。チェックポイントコミットをそのまま複数pushしない）。この固定形式が、push失敗後の次回反復で「自動生成コミットだけ」を安全に識別する根拠になる
    - **pushの実行**: `git push origin $headBranch:$headBranch`（**単なる `git push` は使わない**。経路Bのworktreeや経路Aの現在ディレクトリなど実行場所によらず対象を一意にするため、常にこの完全な refspec を使う）を試み、失敗したら間を置かずもう2回まで再試行する（一時的なネットワーク障害を想定）。それでも失敗する場合は**コミットは取り消さずローカルに残したまま**（せっかく承認された変更を失わないため）、「push失敗、次回反復で再試行」と報告し、**👀リアクションは付けずに**120秒後にScheduleWakeupする（次回の反復開始時、経路Bの `-B` リセットより前に実行される上記「進んでいないか確認する」の手順で再試行される）

    - CLAUDE.md の TDD 規約に従い、test-writer をスキップしない（`implementer` は失敗テストが存在することを前提としている）。**ただし142行目の「テスト対象外モード」に該当する指摘は例外**（この一文は通常モードにのみ適用される）
    - `code-reviewer` が **`CHANGES_REQUESTED`** を返した場合は **`APPROVED` になるまで `implementer` → `code-reviewer` を反復する**（CLAUDE.md サブエージェント運用フロー準拠）。反復回数の内部上限は 3 とし、超えた場合は上記の指摘単位の隔離手順で**この指摘の分だけ**復元し、Codex に「規約違反で自動修正できない」と返信して **その場で** 👀 リアクションを追加する（この指摘は諦めるという結論が確定しているため、他の指摘の結果を待たずに処理済みにしてよい）
  - **👀リアクションはpush成功を確認してから付ける**: `APPROVED` になった指摘は、この反復の最後にまとめてコミット・pushし、**それが成功した後で初めて**該当する各 Codex コメントに 👀 リアクションを追加する。push前に👀を付けると、後続の指摘が内部レビュー上限に達した場合や最後のpush自体が失敗した場合に、既にpush済みと誤認されたまま実際には反映されていない修正が発生し、二度と処理されなくなる（上限到達で新しい marker を投稿できない場合や、Codex の再レビューが同じ指摘を再掲した場合の二重処理防止という👀の本来の目的にも反する）

**指摘カテゴリ判定**（専用エージェントは作らず、`implementer`/`test-writer` 呼び出し時のプロンプトに追加コンテキストとして注入する。理由: 規約チェック自体は `code-reviewer.md` の観点表に集約済みで全カテゴリ共通のため、エージェントを分けると重複する）:

| カテゴリ | 判定キーワード例 | 追加で参照させるドキュメント | 重点確認事項 |
|---------|-----------------|---------------------------|-------------|
| UI/デザイン | レイアウト、CSS、コンポーネント分割、トンマナ、アクセシビリティ、レスポンシブ | `docs/資料系/design-tone-and-manner.md`、`src/components/` 配置規約（CLAUDE.md） | 子供画面/親画面のトンマナ差、500行超のページはフォーム/モーダル抽出を検討したか |
| ロジック/パフォーマンス | N+1、計算量、非効率なクエリ、リファクタ、集約ロジック逸脱 | `src/lib/` モジュール分割規約、XP・進化ロジックのインポート先表（CLAUDE.md） | `approve.ts`/`evolution.ts`/`xp.ts` 経由になっているか、手書きロジックで規約を再実装していないか |
| QA/テスト・型・バグ | テスト不足、型エラー、境界値漏れ、ステータス遷移違反 | CLAUDE.md ステータス遷移表、`src/__tests__/` 命名規約 | 境界値テストの有無、`getUTCDay()` 等の日付規約違反 |

- どのカテゴリにも明確に当てはまらない/複数カテゴリにまたがりどちらか判断に迷う指摘は「QA/テスト・型・バグ」寄りに倒す（安全側: テストで担保されていれば誤修正のリスクが下がるため）
- カテゴリに関わらず `test-writer`（Red）は省略しない。CLAUDE.mdのTDD規約通り、コード修正を伴う指摘は必ず失敗テストを追加してから直す（UI/ロジックカテゴリだからといって既存テストのGreen維持確認だけで済ませない。回帰テストが無いまま承認すると同じ不具合が再発しても検知できない）。**この原則はテスト可能なアプリケーションコードが対象の場合の話であり、142行目の「テスト対象外モード」（ドキュメント/設定ファイルのみの変更）には適用しない**
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
- **実コード修正が入った場合**（Step 5での新規指摘の修正に加え、前回反復で失敗したpushの再送が今回成功したケースを含む。後者は新規に処理した指摘が0件でもここに該当する）:
  - 既存の iteration marker が >= 20 個なら「反復上限（20 回）に達したので追加依頼はせず終了」と報告し、**Step 6.5（上限到達時のエスカレーション）へ進む**
  - そうでなければ `gh pr comment <num> --body $iterationRequest` を投稿（= 新しい marker。Step 1で定義した `$iterationRequest` をそのまま使う。文言をここで独自に書き直さない）
- **返信のみで済んだ場合**: 再依頼しない

### 6.5. 上限到達時のエスカレーション（`/issue-picker` 由来のPRのみ該当）
上限到達で自動化が指摘の解決を諦めたのに、そのまま終了すると `/issue-picker` 由来のPRは `auto:pr-open` のまま誰にも気づかれず永久停止する（`issue-picker` は次回以降このIssueを候補から除外し続けるため）。以下の**どちらの経路でもこの節を実行する**:

- **経路(a)**: 外側の反復上限（20回）に達し、かつまだ未解決の指摘が残っている
- **経路(b)**: この反復が「返信のみで完了し、承認シグナルが無い」（Step 7参照）ケースで、かつその返信の中に**自動解決を断念したもの**が1件以上含まれる場合。「断念」には次の両方を含める: (i) 指摘の内部反復上限（3回）に達して諦めたもの、(ii) `policy-checker` が方針衝突を返し修正せず返信のみで終わったもの（CLAUDE.md/decisions.mdの規約違反を理由に自動修正できない、という点で(i)と本質的に同じ「断念」）。意見・質問系への返信だけで完了した場合は該当しない（純粋なQ&Aは正常終了）。この経路では新しいコミットが入っていても入っていなくても該当し得る（他の指摘が承認されて新しいmarkerが投稿された場合も、断念した指摘自体は別途エスカレーションが必要）

**実行内容**:
- PR本文に `Closes #<N>` の記載があるか確認する（無ければ `/issue-picker` 経由ではない通常のPRなので、この節は何もしない）
- 記載がある場合、その Issue に `auto:pr-open` ラベルが付いていれば `gh issue edit <N> --remove-label "auto:pr-open" --add-label "auto:blocked"` で遷移させ、`gh issue comment <N>` で理由（上限到達／解決を諦めた指摘がある旨）を日本語で報告する
- `PushNotification("Issue #<N> / PR #<num> レビュー反復上限に到達、または一部指摘の解決を断念 — 確認してください")`
- 経路(a)はこの節の実行後に終了する。経路(b)はStep 6の通常の分岐（新しいmarkerを投稿したかどうか）に従って次のwakeupを決める（このエスカレーション自体はwakeupの有無に影響しない。Issueへの通知と、実際のレビュー継続は別軸で扱う）

### 7. 次の wakeup
- ステップ 6 で新しい marker を投稿した → **300 秒後に ScheduleWakeup**（Codex レビュー完了を待つ）
- 返信のみで完了し、未処理指摘が 0 件かつ既存の承認シグナル（ステップ 4-A）がある → **ステップ 4.5** に進み、マージ可能チェックを実行する
- 返信のみで完了し、承認シグナルがない → 👀 リアクションで再検出防止済み。**諦めた指摘が無ければ ScheduleWakeup を呼ばない**（「返信完了」で終了）。**諦めた指摘が1件以上あれば、終了する前に上記6.5の経路(b)を実行する**
- ステップ 4.5 のマージ可能チェック結果に従う

## 出力フォーマット

```
### 反復 <M>/20 (PR #<num>) — <title>
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
- 内部レビューが上限に達した変更を `$headBranch` へ残さない。一時 worktree を破棄し、承認済みの変更だけを取り込む
- Step 5で作業対象が `$headBranch` であることを確認せずに進めない。ただし現在のブランチが既に `$headBranch` なら新しい worktree を作ろうとしない（`already used by worktree` で失敗する）
