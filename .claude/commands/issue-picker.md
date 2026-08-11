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
$prOpenIssues = & $gh issue list --label "auto:pr-open" --state open --limit 200 --json number,body
if ($LASTEXITCODE -ne 0) { throw "auto:pr-open Issue一覧取得失敗 (exit=$LASTEXITCODE)" }
$prOpenIssues = $prOpenIssues | ConvertFrom-Json

$mergeReadyIssues = & $gh issue list --label "auto:merge-ready" --state open --limit 200 --json number,body
if ($LASTEXITCODE -ne 0) { throw "auto:merge-ready Issue一覧取得失敗 (exit=$LASTEXITCODE)" }
$mergeReadyIssues = $mergeReadyIssues | ConvertFrom-Json

$staleDoneIssues = & $gh issue list --label "auto:done" --state open --limit 200 --json number
if ($LASTEXITCODE -ne 0) { throw "auto:done Issue一覧取得失敗 (exit=$LASTEXITCODE)" }
$staleDoneIssues = $staleDoneIssues | ConvertFrom-Json
```
- **各 `gh issue list` 呼び出しの直後に個別に `$LASTEXITCODE` を検査すること**。2個目・3個目の呼び出しの終了コードが1個目のものを上書きするため、まとめて最後に1回だけ検査すると、最初の呼び出しだけが失敗したケースを見逃し、`$prOpenIssues` が空のまま後続処理が続いてしまう
- **両方の呼び出しに `--limit` を明示すること**（Step 1と同じ理由。`auto:pr-open`/`auto:merge-ready` のオープンIssueが既定値30件を超えると、31件目以降が後処理から漏れマージ済みでも永久にクローズされない）
- **検索対象は `auto:pr-open` と `auto:merge-ready` の両方**（正常系では `/codex-followup` がマージ可能判定時にラベルを `auto:pr-open` → `auto:merge-ready` に遷移させるため、`auto:pr-open` だけを見ているとユーザーがマージした後の後片付けを検知できない）
- **`auto:done` ラベルが付いたままopenのIssue（`$staleDoneIssues`）も毎回列挙し、`gh issue close` を再試行する**（後述の通りラベル変更→closeの順で処理するため、closeだけが一時的に失敗するとIssueがopenのまま `auto:done` になる。これを毎回拾い直して再試行しないと、`auto:pr-open`/`auto:merge-ready` の検索対象から外れているぶん永久にクローズされない）
- 各Issueについて、紐づくPRを特定する。**本文のテキスト検索だけで確定させない**: `gh pr list --search '"Closes #<N>" in:body' --state all --json number,state,closingIssuesReferences` で候補を絞り込んだ上で、GitHubが実際に「このPRがどのIssueをcloseするか」を構文解析して計算する `closingIssuesReferences` フィールドに対象Issue番号（`<N>`）が含まれているものだけを採用する（`--search` は単なる全文検索でIssueとの意味的な関連を保証しないため、たまたま同じ文字列を本文に含む無関係なPRを誤って紐付けるリスクがある）。**PowerShellでの引用符に注意**: `\"` は引用符のエスケープにならないため、外側は単一引用符 `'...'` にして内側の `"Closes #<N>"` はそのまま書く。**`--state` を明示すること**（gh CLIの `gh pr list` はデフォルトでopen PRのみを返すため、`--state` を付けないとマージ済みPRが検索結果から消えて永久にStep 0が完了しない）
- 紐づくPRが見つかり `state == "MERGED"` → **先にラベルを `auto:pr-open`/`auto:merge-ready` → `auto:done` に変更してから** `gh issue close <N> --comment "PR #<M> がマージされました"` を実行する（close→ラベル変更の順だと、close成功後にラベル変更だけ失敗した場合に「closed済みだが状態ラベルは進行中のまま」という発見しづらい不整合が残る。ラベル変更→closeの順なら、close側が失敗してもopenのまま `auto:done` ラベルが付くだけなので、`$staleDoneIssues` の再試行で回収できる）
- `$staleDoneIssues` の各Issueは、ラベル変更は既に完了しているので `gh issue close <N>` の再試行のみでよい
- 見つからない/まだOPEN → 何もしない（`/codex-followup` の管轄なのでここでは触らない）

### Step 1. 対象Issue特定

```powershell
$activeIssues = & $gh issue list --label "auto:in-progress" --state open --limit 200 --json number
if ($LASTEXITCODE -ne 0) { throw "auto:in-progress Issue一覧取得失敗 (exit=$LASTEXITCODE)" }
$activeIssues = $activeIssues | ConvertFrom-Json
if ($activeIssues.Count -gt 0) {
  # 他の実行が既に着手中。今回は何もせず終了（「同時に処理するIssueは1件まで」の制約）
  return
}

$candidates = & $gh issue list --label "auto-pickup" --state open --limit 200 --json number,title,body,createdAt,labels
if ($LASTEXITCODE -ne 0) { throw "auto-pickup Issue一覧取得失敗 (exit=$LASTEXITCODE)" }
$candidates = $candidates | ConvertFrom-Json
```
- **`auto:in-progress` が付いたIssueがリポジトリ全体で1件でもあれば、候補選定に進まず即終了する**（「同時に処理するIssueは1件まで」を、対象Issue単体の再確認だけでなくリポジトリ全体の事前チェックとして行う）
- **`--limit` を明示すること**（`gh issue list` の既定値は30件。`auto-pickup` の付いたオープンIssueが30件を超えると、この後のクライアント側フィルタが届かない範囲に未着手Issueが埋もれ、「対象Issueなし」を誤って報告し続ける）
- 各 `gh issue list` 呼び出しの直後に個別に `$LASTEXITCODE` を検査する（Step 0と同じ理由）
- `labels` に `auto:in-progress` / `auto:pr-open` / `auto:merge-ready` / `auto:blocked` / `auto:done` のいずれかを含むIssueは除外する（＝まだどの状態にも入っていない、純粋に未着手のものだけを残す）。**`auto:merge-ready` も必ず含める**（正常系でCodex承認済み・マージ待ちのIssueも `auto-pickup` ラベル自体は残ったままなので、これを除外しないとユーザーがマージするまで同じIssueを毎回最古候補として選び続け、他の未着手Issueの処理が止まる）
- 残った候補が0件 → 「対象Issueなし」と報告して終了
- 複数件残った場合は `createdAt` が最も古い1件だけを選ぶ

### Step 2. 着手宣言（排他制御）

```powershell
$freshLabels = (& $gh issue view <N> --json labels | ConvertFrom-Json).labels.name
& $gh issue edit <N> --add-label "auto:in-progress"
```
- Step 1冒頭の `auto:in-progress` 全体チェックに加えて、ラベル付与の直前に対象Issue個別でも再確認する（`$freshLabels`）。`auto:in-progress`/`auto:pr-open`/`auto:merge-ready`/`auto:blocked`/`auto:done` のいずれかが既に付いていたら「他プロセスが先に着手済み」として何もせず終了する
- **既知の限界**: `gh issue edit --add-label` はロック機構ではなく単なるラベル追加操作であり、2つの実行が真に同時（ミリ秒単位）にStep 1のチェックを通過した場合、両方が「他に着手中のIssueは無い」と判定してから同時にラベルを追加してしまう可能性が理論上残る（GitHub Labels APIに条件付き書き込み/CASが無いため）。本設計はこれを許容し、通常運用（cronルーティン1系統からの逐次起動、または単一のwebhookトリガー）では実質的に同時実行が起きない前提に立つ。真の排他制御が必要になった場合は、別リポジトリの専用ロックファイルやGitHub Actionsのconcurrencyグループ相当の仕組みを別途検討する
- 失敗した場合（他プロセスが同時に処理を開始した等）は何もせず終了
- 成功後、念のため `gh issue view <N> --json labels` で自分が付けたラベルが確かに付いていることを確認してから次に進む（二重着手防止の最終チェック）

### Step 2.5. 異常終了時のセーフティネット（Step 3〜6全体に適用）

Step 4（`policy-checker` の `NEEDS_CONFIRMATION`）と Step 5（レビュー反復上限到達）以外にも、Step 3のworktree作成失敗、各サブエージェントの予期しないエラー、`pr-submitter` の失敗（push権限エラー等）が起こり得る。**これらの未想定の失敗を明示的な2分岐の外に放置しない**: Step 3〜6のどこで失敗しても、必ず以下を実行してから終了する。

1. worktreeが作成済みなら `ExitWorktree` で破棄する（中途半端な変更を残さない）
2. **ラベルを決める前に、PRが既に作成されているか確認する**: `pr-submitter` はpush・PR作成・`gh pr comment`（`@codex review` 投稿）を順番に実行するため、PR自体は作成済みで直後の手順だけが失敗する部分成功があり得る。`gh pr list --search '"Closes #<N>" in:body' --state all --json number,state,closingIssuesReferences` で候補を絞り込み、Step 0と同様に `closingIssuesReferences` に対象Issue番号が含まれるものだけを「既に作成済みのPR」と判定する（本文の文字列検索だけで確定させない。PowerShellでの引用符の書き方もStep 0と同じ）
   - **PRが見つかった場合** → ラベルを `auto:in-progress` → `auto:pr-open` に変更する（`auto:blocked` にすると、既に存在するPRが `/codex-followup` の管轄からもStep 0の後処理対象からも外れ、マージされてもIssueが永久にcloseされなくなる）。`@codex review` がまだ投稿されていなければ投稿する
   - **PRが見つからない場合** → ラベルを `auto:in-progress` → `auto:blocked` に変更する（`auto:blocked` にしないと、Step 1が次回もこのIssueを毎回最古候補として選び直し、同じ失敗を無限に繰り返す）
3. `gh issue comment <N>` で「想定外のエラーで自動実装を中断した」旨とエラー概要（PRが見つかった場合はそのURLも）を日本語で報告する
4. `PushNotification("Issue #<N> 自動実装が想定外のエラーで中断 — 確認してください")`

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
- **追加指示（必須）**: `pr-submitter` の手順は「`main` にいる場合のみ `feature/<task-name>` を新規作成する」という条件付きロジックであり、Step 3で作った `issue-<N>-<slug>` ブランチをそのまま使う想定にはなっていない。呼び出し時に**現在のworktreeブランチ名（`issue-<N>-<slug>`）を明示し、新しいブランチを作らずそのまま push/head として使うよう**指示すること。指示を省略すると、`pr-submitter` が存在しない `feature/*` ブランチへのpushを試みて失敗する
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
- Step 1冒頭の `auto:in-progress` 全体チェックを省略しない（対象Issue個別の再確認だけでは、別Issueが既に処理中のケースを検知できない）
- PRの紐付けを本文の文字列検索（`--search`）だけで確定しない。必ず `closingIssuesReferences` で対象Issue番号と照合する
- `policy-checker` が `NEEDS_CONFIRMATION` を出したのに実装を続行しない
- `code-reviewer` が `APPROVED` を出す前に `pr-submitter` を呼ばない
- レビュー反復の内部上限（3回）を超えて `implementer` ⇄ `code-reviewer` を回し続けない
- `main` への直接コミット・直接PRをしない（base は常に `develop`）
- worktreeで作った未承認の変更を破棄せずに残さない（`auto:blocked` になったら必ず `ExitWorktree` で片付ける）
- Step 0の後片付けで、`auto:pr-open` のPRがまだOPENなのに `auto:done` に進めない（`/codex-followup` の管轄を横取りしない）
