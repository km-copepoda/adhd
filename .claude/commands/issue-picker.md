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
- 各Issueについて、紐づくPRを特定する。**`closingIssuesReferences` は使わない**: このフィールドはGitHubのclosing keyword（`Closes #<N>` 等）がPRのbaseがリポジトリの**デフォルトブランチ**の場合にのみ計算される。このパイプラインのPRは常に `develop` 向けで、リポジトリのデフォルトブランチは `main` のため（17行目に明記の通り自動クローズ自体も発火しない）、`closingIssuesReferences` は常に空になり使えない
  - 代わりに `gh pr list --search '"Closes #<N>" in:body' --state all --json number,state,body` で候補を絞り込み（**PowerShellでの引用符に注意**: `\"` は引用符のエスケープにならないため、外側は単一引用符 `'...'` にして内側の `"Closes #<N>"` はそのまま書く）、各候補の `body` を取得して `(?i)\bcloses\s+#<N>\b`（大文字小文字不問、`<N>` の前後は単語境界）に正規表現で一致するかを自前で検証する。`--search` はあくまで候補を絞る高速フィルタとして使い、最終判定は取得した本文への正規表現マッチで行う（`#<N>` が `#<N>0` のような別Issue番号の一部にマッチしないよう単語境界を必須にする）
  - **`--state` を明示すること**（gh CLIの `gh pr list` はデフォルトでopen PRのみを返すため、`--state` を付けないとマージ済みPRが検索結果から消えて永久にStep 0が完了しない）
- 紐づくPRが見つかり `state == "MERGED"` → **先にラベルを `auto:pr-open`/`auto:merge-ready` → `auto:done` に変更してから** `gh issue close <N> --comment "PR #<M> がマージされました"` を実行する（close→ラベル変更の順だと、close成功後にラベル変更だけ失敗した場合に「closed済みだが状態ラベルは進行中のまま」という発見しづらい不整合が残る。ラベル変更→closeの順なら、close側が失敗してもopenのまま `auto:done` ラベルが付くだけなので、`$staleDoneIssues` の再試行で回収できる）。**ラベル変更の `$LASTEXITCODE` を検査し、成功を確認できた場合のみ `gh issue close` に進む**（ラベル変更が失敗したままcloseだけ成功すると、`auto:pr-open`/`auto:merge-ready` のままclosedになり、Step 0の回収クエリは全て `--state open` なのでこの不整合は二度と修復されない）
- `$staleDoneIssues` の各Issueは、ラベル変更は既に完了しているので `gh issue close <N>` の再試行のみでよい
- 見つからない/まだOPEN → 何もしない（`/codex-followup` の管轄なのでここでは触らない）

### Step 1. 対象Issue特定

```powershell
$activeIssues = & $gh issue list --label "auto:in-progress" --state open --limit 200 --json number,updatedAt
if ($LASTEXITCODE -ne 0) { throw "auto:in-progress Issue一覧取得失敗 (exit=$LASTEXITCODE)" }
$activeIssues = $activeIssues | ConvertFrom-Json

$staleThresholdMinutes = 180
$stillActive = @()
foreach ($issue in $activeIssues) {
  $ageMinutes = ((Get-Date).ToUniversalTime() - [DateTime]::Parse($issue.updatedAt).ToUniversalTime()).TotalMinutes
  if ($ageMinutes -gt $staleThresholdMinutes) {
    # 放置されたロックとみなして回収する（プロセス強制終了・セッション喪失等でStep 2.5のセーフティネットが
    # 一度も走れなかった場合、ラベルに有効期限が無いためこのままだと以後の起動が永久に全滅する）
    & $gh issue edit $issue.number --remove-label "auto:in-progress" --add-label "auto:blocked"
    if ($LASTEXITCODE -ne 0) {
      # ラベル遷移に失敗した＝実際にはまだ auto:in-progress のまま。回収できたと見なさず
      # 「現在も着手中」の扱いにして候補選定へ進まない（二重着手を防ぐ安全側の判断）
      $stillActive += $issue
      continue
    }
    & $gh issue comment $issue.number --body "auto:in-progress が $([math]::Round($ageMinutes))分間更新されず放置されていたため、自動的に auto:blocked へ回収しました。状況を確認してください。"
    # PushNotification("Issue #<issue.number> の着手ロックが放置されていたため自動回収しました — 確認してください")
  } else {
    $stillActive += $issue
  }
}
if ($stillActive.Count -gt 0) {
  # 他の実行が現在も着手中（閾値内、またはロック回収に失敗）。今回は何もせず終了（「同時に処理するIssueは1件まで」の制約）
  return
}

$candidates = & $gh issue list --label "auto-pickup" --state open --limit 200 --json number,title,body,createdAt,labels
if ($LASTEXITCODE -ne 0) { throw "auto-pickup Issue一覧取得失敗 (exit=$LASTEXITCODE)" }
$candidates = $candidates | ConvertFrom-Json
```
- **`auto:in-progress` が付いたIssueがリポジトリ全体にあり、かつ直近 `$staleThresholdMinutes`（180分＝3時間）以内に更新されていれば、候補選定に進まず即終了する**（「同時に処理するIssueは1件まで」を、対象Issue単体の再確認だけでなくリポジトリ全体の事前チェックとして行う）
- **180分を超えて更新が無い `auto:in-progress` は「放置されたロック」とみなし、自動的に `auto:blocked` へ回収してから処理を続行する**。ラベル自体には有効期限も所有者情報も無いため、着手したプロセスが強制終了・セッション喪失・runner停止等でStep 2.5のセーフティネットまで到達できなかった場合、回収機構が無いと1件の残留ラベルがパイプライン全体を無条件かつ永久に停止させてしまう。`updatedAt`（ラベル変更・コメント等で更新される）を目安の経過時間として使う
- **既知の限界（Step 2の排他制御と同種の限界）**: これは真のリース/ハートビート機構ではない。`auto:in-progress` を保持する期間は本来 Step 2（着手宣言）〜Step 6（PR作成・`auto:pr-open`への遷移）の間だけで、Codexレビュー往復のような長時間の待機はその前に `auto:pr-open` へ遷移して手放しているため、正常系でこの期間が180分を超えることは通常想定しにくい。それでも極端に長いレビュー反復やツール障害で正常稼働中のプロセスが誤って回収される可能性は理論上残る（その場合、2つの実行が同時に別のIssueに着手し得る）。真の排他制御が必要になれば、実行中プロセスが定期的に更新するハートビート付きの所有者情報を持たせる設計に切り替える
- **`--limit` を明示すること**（`gh issue list` の既定値は30件。`auto-pickup` の付いたオープンIssueが30件を超えると、この後のクライアント側フィルタが届かない範囲に未着手Issueが埋もれ、「対象Issueなし」を誤って報告し続ける）
- 各 `gh issue list` 呼び出しの直後に個別に `$LASTEXITCODE` を検査する（Step 0と同じ理由）
- `labels` に `auto:in-progress` / `auto:pr-open` / `auto:merge-ready` / `auto:blocked` / `auto:done` のいずれかを含むIssueは除外する（＝まだどの状態にも入っていない、純粋に未着手のものだけを残す）。**`auto:merge-ready` も必ず含める**（正常系でCodex承認済み・マージ待ちのIssueも `auto-pickup` ラベル自体は残ったままなので、これを除外しないとユーザーがマージするまで同じIssueを毎回最古候補として選び続け、他の未着手Issueの処理が止まる）
- 残った候補が0件 → 「対象Issueなし」と報告して終了
- 複数件残った場合は `createdAt` が最も古い1件だけを選ぶ

### Step 2. 着手宣言（排他制御）

```powershell
$freshLabelsJson = & $gh issue view <N> --json labels
if ($LASTEXITCODE -ne 0) { throw "ラベル再確認取得失敗 (exit=$LASTEXITCODE)" }
$freshLabels = ($freshLabelsJson | ConvertFrom-Json).labels.name
& $gh issue edit <N> --add-label "auto:in-progress"
```
- **この `gh issue view` の `$LASTEXITCODE` を必ず検査する**。検査せずに進むと、一時的な取得失敗時に `$freshLabels` が空になり「衝突ラベルなし」と誤判定して `auto:in-progress` を重ねて付与してしまう（対象Issueが既に `auto:pr-open`/`auto:blocked` 等で他プロセスに処理済みだった場合、それを見落として二重着手する）
- Step 1冒頭の `auto:in-progress` 全体チェックに加えて、ラベル付与の直前に対象Issue個別でも再確認する（`$freshLabels`）。`auto:in-progress`/`auto:pr-open`/`auto:merge-ready`/`auto:blocked`/`auto:done` のいずれかが既に付いていたら「他プロセスが先に着手済み」として何もせず終了する
- **既知の限界**: `gh issue edit --add-label` はロック機構ではなく単なるラベル追加操作であり、2つの実行が真に同時（ミリ秒単位）にStep 1のチェックを通過した場合、両方が「他に着手中のIssueは無い」と判定してから同時にラベルを追加してしまう可能性が理論上残る（GitHub Labels APIに条件付き書き込み/CASが無いため）。本設計はこれを許容し、通常運用（cronルーティン1系統からの逐次起動、または単一のwebhookトリガー）では実質的に同時実行が起きない前提に立つ。真の排他制御が必要になった場合は、別リポジトリの専用ロックファイルやGitHub Actionsのconcurrencyグループ相当の仕組みを別途検討する
- 失敗した場合（他プロセスが同時に処理を開始した等）は何もせず終了
- 成功後、念のため `gh issue view <N> --json labels` で自分が付けたラベルが確かに付いていることを確認してから次に進む（二重着手防止の最終チェック）

### Step 2.5. 異常終了時のセーフティネット（Step 2でのラベル付与直後〜Step 6全体に適用）

Step 4（`policy-checker` の `NEEDS_CONFIRMATION`）と Step 5（レビュー反復上限到達）以外にも、**Step 2で `auto:in-progress` を付与した直後**（確認用の `gh issue view` 失敗を含む）、Step 3のworktree作成失敗、各サブエージェントの予期しないエラー、`pr-submitter` の失敗（push権限エラー等）が起こり得る。**これらの未想定の失敗を明示的な2分岐の外に放置しない**: `auto:in-progress` を付与した**その瞬間から** Step 6が終わるまでのどこで失敗しても、必ず以下を実行してから終了する（Step 3以降に限定しない。Step 2の直後で失敗した場合、worktreeはまだ無いので1は該当なしとして次に進む）。

1. worktreeが作成済みなら `ExitWorktree` で破棄する（中途半端な変更を残さない）。**`ExitWorktree` はworktreeディレクトリを消すだけでローカルブランチ `issue-<N>-<slug>` 自体は削除しない**点に注意（次項へ続く）
2. **ラベルを決める前に、PRが既に作成されているか確認する**: `pr-submitter` はpush・PR作成・`gh pr comment`（`@codex review` 投稿）を順番に実行するため、PR自体は作成済みで直後の手順だけが失敗する部分成功があり得る。Step 0と同じ方法（`closingIssuesReferences` は使わず、`--search` で候補を絞ってから本文を正規表現 `(?i)\bcloses\s+#<N>\b` で検証。PowerShellでの引用符の書き方もStep 0と同じ）で候補PRを見つけたら、**`state == "OPEN"` のものだけを「既に作成済みのPR」として扱う**（過去の試行で作られCLOSEDになった無関係なPRが見つかっても無視する。CLOSEDを「PR見つかった」として`auto:pr-open`に戻すと、`/codex-followup`は即座にCLOSEDとして終了し、Step 0も`MERGED`条件に一致しないため、Issueが永久に`auto:pr-open`のまま停止する）
   - **OPENなPRが見つかった場合** → ラベルを `auto:in-progress` → `auto:pr-open` に変更する（`auto:blocked` にすると、既に存在するPRが `/codex-followup` の管轄からもStep 0の後処理対象からも外れ、マージされてもIssueが永久にcloseされなくなる）。`@codex review` がまだ投稿されていなければ投稿する。ローカルブランチはリモートに対応するので削除しない
   - **OPENなPRが見つからない場合**（無関係なCLOSED PRのみヒットした場合を含む）→ ラベルを `auto:in-progress` → `auto:blocked` に変更する（`auto:blocked` にしないと、Step 1が次回もこのIssueを毎回最古候補として選び直し、同じ失敗を無限に繰り返す）。**「PRが無い」は「pushもされていない」を意味しない**（`pr-submitter` はpushしてから `gh pr create` するため、push成功後にPR作成だけ失敗する部分成功があり得る）。ローカルブランチを消す前に `git ls-remote --heads origin issue-<N>-<slug>` でリモートブランチの有無も確認する:
     - リモートブランチが**無い** → `git branch -D issue-<N>-<slug>` でローカルブランチを削除する
     - リモートブランチが**ある** → `git push origin --delete issue-<N>-<slug>` でリモートブランチも削除してから、ローカルブランチを削除する（リモートだけ残すと、再試行時に新しく作ったローカルブランチをpushする際、履歴が異なる同名リモートブランチに対してnon-fast-forwardで失敗し続ける）
3. `gh issue comment <N>` で「想定外のエラーで自動実装を中断した」旨とエラー概要（PRが見つかった場合はそのURLも）を日本語で報告する
4. `PushNotification("Issue #<N> 自動実装が想定外のエラーで中断 — 確認してください")`

### Step 3. Worktree作成

- **`develop` を明示的な起点にすること**。`EnterWorktree` はデフォルトでリポジトリの「デフォルトブランチ」（`origin/<default-branch>`）を起点にするが、このリポジトリのデフォルトブランチは `main` であり `develop` ではない（`pr-submitter` のPR base規約と同じ）。`EnterWorktree` の既定動作に任せず、`git fetch origin develop` の後 `git worktree add .claude/worktrees/issue-<N>-<slug> -b issue-<N>-<slug> origin/develop` のように**起点を `origin/develop` に固定して明示的に作成する**（呼び出し元の現在ブランチが `main` や別のfeatureブランチであっても、必ず `develop` を起点にする）
- ブランチ名: `issue-<N>-<slug>`（`slug` はIssueタイトルから生成。日本語タイトルの場合はローマ字化 or 簡略な英語スラッグに変換する）

### Step 4. `policy-checker`

- Issueの `目的` / `背景` / `実装方針` セクションを結合したものを「ユーザーの指示」として渡す
- `NEEDS_CONFIRMATION` の場合:
  - `gh issue comment <N>` で衝突箇所を日本語で説明する
  - ラベルを `auto:in-progress` → `auto:blocked` に変更
  - `PushNotification("Issue #<N> は方針衝突のため自動着手不可 — 確認してください")`
  - worktreeを破棄（`ExitWorktree`）し、**`git branch -D issue-<N>-<slug>` でローカルブランチも削除する**（この時点でpushはまだ行われていないので安全に削除できる。削除しないと、人間が内容を確認して `auto:blocked` を解除し同じIssueを再試行した際、Step 3の `-b` によるブランチ作成が `already exists` で失敗する）。終了
- `OK` の場合 → Step 5へ

### Step 5. TDD実装ループ

0. **対象がテスト可能なコード変更かどうかを先に判定する**: Issueの影響範囲がドキュメント/設定ファイル（`.gitignore`、`docs/`、`.claude/agents/*.md`、`.claude/commands/*.md` 等、関数・モジュール・APIを持たない変更）のみの場合、`test-writer` は「関数・モジュール・APIを対象に失敗テストを書く」契約であり正当なRedを作れない。この場合は `test-writer` を呼ばず、**`implementer`/`code-reviewer` それぞれの「テスト対象外モード」を明示して**呼ぶ（両エージェントとも通常はテスト前提の設計になっているため、モードを明示しないと `implementer` が失敗テストを探して混乱するか、`code-reviewer` がテスト欠如を理由に `CHANGES_REQUESTED` を返し続けて `auto:blocked` になる）。**判定に迷う場合は必ず `test-writer` を呼ぶ側に倒す**（テスト可能なのにスキップする方が、不要な判定コストより実害が大きい）
1. `test-writer`（Red）— 0で「テスト対象なし」と判定した場合はスキップ
2. `implementer`（Green + Refactor）
3. `code-reviewer`
4. `code-reviewer` が `CHANGES_REQUESTED` → `implementer` に差し戻し、`APPROVED` になるまで反復（内部上限3回）
5. 上限到達で `APPROVED` にならなかった場合:
   - worktreeの変更を破棄（`ExitWorktree`）し、**`git branch -D issue-<N>-<slug>` でローカルブランチも削除する**（`ExitWorktree` はworktreeディレクトリを消すだけでブランチ自体は残る。未pushとはいえ削除しないと、再試行時にStep 3の `-b` によるブランチ作成が `already exists` で失敗する）
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

- **「オープンPRを別途巡回するルーティン」は現時点で存在しない**（`docs/未実装仕様書/issue-auto-pipeline.md` 8章の実装チェックリスト参照。webhook/cronルーティンの配線は未着手）。存在を前提にしない
- 本コマンド自身が「PR #<M> についてcodex-followupを実行する」のように**呼び出し指示の文中でPR番号を明示**して `/codex-followup` を1反復実行する（`gh pr view` の現在ブランチ依存解決に頼らない。Step 7で既にworktreeを離れているため、明示的にPR番号を渡さないと対象PRを解決できない。`codex-followup.md` 側もこの呼び出し指示中のPR番号の有無で分岐する規約になっている）
- 以降の反復（Codexレビュー対応・マージ可否判定・通知）は `/codex-followup` 自身の `ScheduleWakeup` によるセルフペーシングに委ねる。本コマンドはその最初の1反復を起動するところまでが責務

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
- PRの紐付けを `--search` の結果だけで確定しない（無関係なPRが偶然ヒットしうる）。必ず取得した本文を正規表現 `(?i)\bcloses\s+#<N>\b` で照合する。`closingIssuesReferences` は `develop` 向けPRでは常に空なので使わない
- `policy-checker` が `NEEDS_CONFIRMATION` を出したのに実装を続行しない
- `code-reviewer` が `APPROVED` を出す前に `pr-submitter` を呼ばない
- レビュー反復の内部上限（3回）を超えて `implementer` ⇄ `code-reviewer` を回し続けない
- `main` への直接コミット・直接PRをしない（base は常に `develop`）
- worktreeで作った未承認の変更を破棄せずに残さない（`auto:blocked` になったら必ず `ExitWorktree` で片付ける）
- Step 0の後片付けで、`auto:pr-open` のPRがまだOPENなのに `auto:done` に進めない（`/codex-followup` の管轄を横取りしない）
