# Issue自動着手パイプライン 仕様書

作成日: 2026-08-11
更新: 2026-08-11 — 「深層思考Issue作成サブエージェント」「指摘カテゴリ別ルーティング」を Claude Code 純正構成で追記（10章・11章）

## 0. 目的

現状、以下は実装済み:

- サブエージェント運用フロー（`policy-checker → test-writer → implementer → code-reviewer → pr-submitter`、`.claude/agents/*.md`）
- `/codex-followup`（`.claude/commands/codex-followup.md`）— PR作成後、Codexレビューへの対応を最大3反復し、CI green & マージ可能になったら `PushNotification` で「MERGE READY」を通知して**停止**（自動マージはしない）

欠けているのは **「ユーザーの雑な指示 → Issue化 → 自動着手」という入口部分**。これが埋まれば、

```
ユーザーの雑な指示（Issue化されていない）
  → issue-planner（深層思考でIssue化。10章）
  → gh issue create（ラベル無し。スコープ評価は本文に推奨として記載するのみ）
  → 人間が内容を確認し auto-pickup ラベルを付与（この操作だけが実際の着手許可）
  → Webhookトリガーで issue-picker が拾う
  → policy-checker → TDDループ（test-writer/implementer/code-reviewer） → pr-submitter
  → /codex-followup が Codex レビューを反復対応（指摘をカテゴリ判定して implementer へ適切なコンテキストを付与。11章）
  → マージ可能通知（PushNotification）
  → ユーザーが手動でマージ判断・実行 ← ここで必ず人間が介在
```

という一気通貫のパイプラインになる。**マージだけは既存設計上も新設計上も自動化しない**（`/codex-followup` が既に「通知して止まる」設計になっているため、これを踏襲する）。

**なぜ生のOpenAI API + 外部Pythonオーケストレーターではなく Claude Code 純正構成にしたか**: このリポジトリには既に `chatgpt-codex-connector[bot]` という実際のCodex GitHub App連携があり、`@codex review` コメントで動く。別途 GitHub Actions から生の OpenAI API を叩くレビューボットを追加すると、1つのPRに性質の違う自動レビューが二重に付き `/codex-followup` の投稿者判定ロジックとも噛み合わない。また `claude --dangerously-skip-permissions --print` を外部スクリプトから定期実行する構成は権限確認を全スキップするフルオート実行であり、CLAUDE.mdの「非標準の修正手法は確認を求める」に該当するため採用しない。

---

## 1. 全体像（既存 / 新規の切り分け）

| フェーズ | 担当 | 状態 |
|---------|------|------|
| 雑な指示 → Issue化（深層思考） | 新規: `issue-planner` サブエージェント（10章） | **未実装** |
| Issue検知・着手判断 | 新規: `/issue-picker` + トリガー機構 | **未実装** |
| 排他制御（二重着手防止） | 新規: ラベルによる状態管理 | **未実装** |
| 方針衝突チェック | 既存: `policy-checker` サブエージェント | 実装済み（流用） |
| TDD実装 | 既存: `test-writer` → `implementer` → `code-reviewer` | 実装済み（流用） |
| PR作成・Codexレビュー依頼 | 既存: `pr-submitter` | 実装済み（流用、Issue紐付けの一部追加が必要） |
| Codexレビュー反復 | 既存: `/codex-followup` | 実装済み（流用 + カテゴリ判定を追記。11章） |
| 指摘のカテゴリ別コンテキスト注入 | 新規: `/codex-followup` Step 5 拡張（11章） | **未実装** |
| マージ可否通知 | 既存: `/codex-followup` 内 `PushNotification` | 実装済み |
| マージ実行 | 人間 | 意図的に自動化しない |
| Issueクローズ | 新規: マージ検知後の後処理 | **未実装**（後述 5 章、盲点あり） |

---

## 2. Issue状態管理（ラベル設計）

Issueの「今どの段階か」をラベルで管理する。DBや外部状態ストアを持たず、GitHub Issue自体を状態機械にする。

| ラベル | 意味 | 付与者 | 次の状態 |
|--------|------|--------|---------|
| `auto-pickup` | 「このIssueは自動着手してよい」という**人間の明示的な許可**。これが無いIssueは絶対に自動着手しない | 人間（Issue登録者 or トリアージ担当） | `issue-picker` が拾う対象になる |
| `auto:in-progress` | `issue-picker` が着手し、worktreeで実装中 | `issue-picker`（着手宣言として即座に付与） | `auto:pr-open` または `auto:blocked` |
| `auto:pr-open` | PR作成済み、Codexレビュー反復中（`/codex-followup` の管轄） | `issue-picker`（PR作成直後） | `auto:merge-ready` または（反復失敗時）`auto:blocked` |
| `auto:merge-ready` | CI green・Codex承認・マージ可能。ユーザーの操作待ち | `/codex-followup`（MERGE READY検知時） | 人間がマージ → `auto:done` |
| `auto:blocked` | 方針衝突 or レビュー反復上限到達で自動化を諦めた。人間の判断が必要 | `issue-picker` または `/codex-followup` | 人間が対応後、ラベルを手動で外して再度 `auto-pickup` を付け直せば再挑戦可能 |
| `auto:done` | PRマージ済み、Issue対応完了 | 新設の後処理ステップ（5章） | （終端） |

**運用ルール**:
- `auto-pickup` は必ず人間が付ける（自動分類はしない）。Issue本文が曖昧・スコープが大きすぎる等は人間が事前に弾く前提
- `auto:*` 系ラベルは自動化プロセスのみが付け外しする。人間が手で操作すると二重着手やロストの原因になるので触らない運用にする
- 同時に `auto:in-progress` を持つIssueが存在する状態で、別のIssueの `auto-pickup` を拾わない（= 1件ずつ処理。3章で理由を補足）

---

## 3. トリガー方式（Issue検知の仕組み）

### 案A: Webhookトリガー（推奨）

`RemoteTrigger` ツールの `create_webhook_trigger` で、GitHubの `issues` イベント（`labeled`、対象ラベル `auto-pickup`）を購読し、`schedule` スキルで事前に作成した**クラウドルーティン**を起動する。

```
GitHub Issueに auto-pickup ラベル付与
  → GitHub webhookイベント発火
  → RemoteTrigger 経由でルーティン起動（クラウド上、ローカルセッション不要）
  → ルーティンが /issue-picker 相当の手順を実行
```

- 利点: ほぼリアルタイム。ローカルでClaude Codeセッションを開いている必要がない（ユーザーがPCを閉じていても動く）
- 実装時に必要な調査: `create_webhook_trigger` の正確なbody形状（イベントフィルタの書き方）は未確認。実装フェーズで `schedule` スキル経由でルーティンを1つ作った上で、`RemoteTrigger` の `create`/`create_webhook_trigger` を実際に叩いて確認する

### 案B: ポーリング（フォールバック）

`schedule` スキルでクラウドルーティンを作り、cronで定期的に（例: 20〜30分間隔）`gh issue list --label auto-pickup` を叩いて未着手Issueを探す。

- 利点: 実装が単純。webhook購読が使えない/不安定な場合の代替になる
- 欠点: 検知に最大ポーリング間隔ぶんの遅延が出る

### 却下: `CronCreate` / `ScheduleWakeup`

- `CronCreate` は「このセッション」に紐づくジョブで、セッション終了とともに失われる（`CronList` の説明に明記）。Issue検知は「ユーザーがセッションを開いていない時」にこそ動いてほしいので不適
- `ScheduleWakeup` は `/loop` の動的ペーシング用で、そもそも会話が起動している前提。Issue登録という「何もしていない状態から始まるトリガー」には使えない

**結論**: v1は**案A（Webhook）を優先実装**し、確認が取れない/不安定な場合のみ案Bにフォールバックする。

---

## 4. 新規スラッシュコマンド `/issue-picker` の詳細手順

`.claude/commands/codex-followup.md` と同じ粒度で新規に `.claude/commands/issue-picker.md` を作る想定。手順:

### Step 1. 対象Issue特定
```
gh issue list --label auto-pickup --label -auto:in-progress --label -auto:pr-open --label -auto:blocked --label -auto:done --json number,title,body,createdAt
```
（`gh` の除外ラベル記法は実装時に要検証。使えなければ取得後にJS/PowerShell側でフィルタする）
- 該当0件 → 何もせず終了
- 該当複数件 → **`createdAt` が最も古い1件のみ**処理する（同時並行はしない。理由: worktree・ブランチ・CIリソースの競合を避け、レビュー負荷も1件ずつに抑えるため）

### Step 2. 着手宣言（排他制御）
- 対象Issueに `auto:in-progress` を即座に付与（`gh issue edit <N> --add-label auto:in-progress`）
- ここで失敗する/競合する場合（他プロセスが同時に同じIssueを拾った等）は何もせず終了

### Step 3. worktree作成
- `EnterWorktree` でIssue専用の一時worktreeを作る。ブランチ名は `issue-<N>-<slug>`（`slug` はIssueタイトルから生成）
- ベースは `develop`（`main` 直接コミット禁止はCLAUDE.md・`pr-submitter` 規約通り）

### Step 4. `policy-checker`
- Issue本文を「ユーザーの指示」としてそのまま渡す
- `NEEDS_CONFIRMATION` → 実装せず、`gh issue comment <N>` で衝突箇所を日本語で説明し、ラベルを `auto:in-progress` → `auto:blocked` に変更、`PushNotification("Issue #<N> は方針衝突のため自動着手不可 — 確認してください")`。worktree破棄して終了
- `OK` → Step 5へ

### Step 5. TDD実装ループ
- `test-writer`（Red）→ `implementer`（Green+Refactor）→ `code-reviewer`
- `code-reviewer` が `CHANGES_REQUESTED` → `APPROVED` になるまで `implementer` ⇄ `code-reviewer` を反復（内部上限3回、`/codex-followup` の既存規約に合わせる）
- 上限到達で未承認のまま → worktreeを破棄（変更を残さない）、ラベルを `auto:blocked` に変更、`gh issue comment` で「自動実装できなかった」旨を報告、`PushNotification("Issue #<N> 自動実装失敗（レビュー規約に収束せず）")`。終了

### Step 6. `pr-submitter`
- 既存手順のまま実行（base=`develop`、`@codex review Please review in Japanese.` を投稿）
- **追加事項**: PR本文に `Closes #<N>` を含める（5章の理由により実際の自動クローズは効かないが、GitHub UI上でのIssue⇄PRの相互参照リンクとしては機能するため残す）
- PR作成後、Issueラベルを `auto:in-progress` → `auto:pr-open` に変更し、`gh issue comment <N> --body "PR #<M> を作成しました: <URL>"` で経過を記録

### Step 7. worktree破棄
- `ExitWorktree` で後片付け（ブランチ自体はリモートに push 済みなので消えない）

### Step 8. レビュー反復への引き継ぎ
- ここから先は既存の `/codex-followup` がそのまま担当する。`issue-picker` 側から追加の呼び出しは不要（`pr-submitter` がPRを作った時点で `/codex-followup` 用のcronルーティンが同じPRを見つけて拾えるように、案A/Bどちらのトリガーも「オープンPRでCodexレビュー未完了のもの」を巡回する設計にしておく）

---

## 5. 盲点: `develop` ベース運用ではIssueが自動クローズされない

GitHubの `Closes #<N>` / `Fixes #<N>` によるIssue自動クローズは、**そのリポジトリのデフォルトブランチへマージされた時のみ**発動する。

このプロジェクトは `pr-submitter` の規約上、PRのbaseは常に `develop` であり `main` ではない（`restrict-main-merge.yml` により `main` への直接PRも拒否される）。つまり **`develop` へのマージでは `Closes #<N>` が効かず、Issueは自動クローズされない**。

### 対策

後処理ステップを別途用意する（`issue-picker` の次回起動時、または専用の軽量チェックとして）:

1. `auto:pr-open` ラベルが付いているIssueを列挙
2. 紐づくPRの状態を `gh pr view <M> --json state,mergedAt` で確認
3. `state == "MERGED"` なら:
   - `gh issue close <N> --comment "PR #<M> がマージされました"`
   - ラベルを `auto:pr-open` → `auto:done` に変更
4. `main` への昇格タイミング（`develop → main` のリリースPR）で二重にクローズしようとしてもGitHub側は無害（既にクローズ済みなら何もしない）ので問題ない

この後処理は `issue-picker` のStep 1の直前に「まず前回分の後片付けをする」形で組み込むのが自然（新しいIssueを拾う前に、完了したIssueを閉じる）。

---

## 6. 安全装置（ガードレール）

- `auto-pickup` ラベルが無いIssueには**絶対に**着手しない（自動分類・自動判定はしない。スコープの妥当性判断は人間に委ねる）
- `policy-checker` を必ず実装前に通す（既存フロー通り）
- レビュー反復上限（3回）を超えたら諦めて人間にエスカレーションする。無限に反復しない
- `main` への直接コミット・直接PRは既存規約通り禁止
- `npm test` / `npm run lint` が通らない状態のコードは絶対にpushしない
- **マージは自動化しない**。`/codex-followup` の「MERGE READY通知で停止」という既存設計をそのまま踏襲する
- 同時に処理するIssueは1件まで（worktree・CI・レビュー枠の競合防止）
- `auto:blocked` になったIssueを自動で再試行しない。人間がラベルを付け直すまで放置する

---

## 7. 通知設計（`PushNotification` 一覧）

| タイミング | 通知内容（例） |
|-----------|----------------|
| issue-planner がIssueを作成（毎回。ラベルは付けないため必ず人間の確認が必要） | `Issue #<N> を起票（<自動着手向き｜自動着手非推奨>） — <title>` |
| policy-checker で衝突検出 | `Issue #<N> は方針衝突のため自動着手不可 — 確認してください` |
| レビュー反復上限到達（実装フェーズ） | `Issue #<N> 自動実装失敗（レビュー規約に収束せず）` |
| PR作成完了 | （通知しない。`gh issue comment` への記録のみで十分。頻度を絞る） |
| マージ可能（`/codex-followup` 既存） | `PR #<M> merge ready — <title>` |
| CI失敗（`/codex-followup` 既存） | `PR #<M> Codex approved but CI failed — <title>` |
| マージコンフリクト（`/codex-followup` 既存） | `PR #<M> Codex approved but merge conflict — <title>` |
| Issue自動クローズ完了 | （通知しない。ノイズになるため。Issueコメントへの記録のみ） |

通知は「人間の判断が必要な場面」と「マージ準備完了」のみに絞り、進捗の逐次通知はしない（`/codex-followup` の既存方針を踏襲）。

---

## 8. 実装チェックリスト（このドキュメントはここまで。実装は別タスク）

- [x] GitHubラベル作成: `auto-pickup`, `auto:in-progress`, `auto:pr-open`, `auto:merge-ready`, `auto:blocked`, `auto:done`（`gh label create`）— 2026-08-11 作成済み
- [x] `.claude/agents/issue-planner.md` 新規作成（10章）— 2026-08-11、Issue #15 で動作確認済み
- [x] `.claude/commands/issue-picker.md` 新規作成（4章の手順をcodex-followup.md相当の粒度で明文化）— 2026-08-11 作成済み・**Step 0-8 通し検証済み（12章）**
- [x] `.claude/commands/codex-followup.md` のStep 5に指摘カテゴリ判定ロジックを追記（11章）— 2026-08-11 追記済み・**未検証**
- [x] `code-reviewer.md` / `implementer.md` の lint チェックを「変更ファイルのみ対象」に修正 — 2026-08-11（12章の課題2対応）
- [x] `Agent` ツールが既存サブエージェントを認識しない問題 — 原因はBOM付きファイル、除去して解決（12章の課題1）。2026-08-11
- [ ] **webhook配線の前に推奨**: 自動化を実行する環境（`schedule` スキルのクラウドルーティン等）でも同様のBOM問題が起きないか、または別の認識問題が無いかを一度確認する（対処法自体は判明済みなのでブロッカーではない）
- [ ] `schedule` スキルでクラウドルーティンを作成し、そこから `/issue-picker` 相当の手順を実行させる
- [ ] `RemoteTrigger` の `create_webhook_trigger` で GitHub `issues.labeled` イベント（ラベル=`auto-pickup`）を購読し、上記ルーティンに接続。body形状は実装時に要検証
- [x] 5章の後処理（PRマージ検知→Issueクローズ）を `issue-picker` の冒頭ステップとして組み込む — issue-picker.md の Step 0 として反映済み。**マージ済みPRが無いため実挙動は未検証**
- [x] `CLAUDE.md` の「サブエージェント運用フロー」表に、`issue-planner` を#0として追加し、Issue自動着手パイプラインの現況を追記 — 2026-08-11
- [ ] 案A（Webhook）が実装困難と判明した場合のみ、案B（ポーリング）に切り替え

---

## 9. 未決事項（実装着手前にユーザー確認が必要）

- [ ] 1回の起動で処理するIssue件数は1件固定でよいか（並行処理を許すか）
- [ ] Webhookイベントは `issues.labeled`（ラベル付与時点で即発火）でよいか、それとも `issues.opened` + 別途ラベルチェックにするか
- [ ] `auto:blocked` になったIssueの再試行は完全手動でよいか（自動リトライを入れるか）
- [ ] Issueコメントでの経過報告の粒度（着手時・PR作成時・クローズ時、以外に追加したい報告があるか）
- [ ] レビュー反復上限（3回）は `/codex-followup` と揃えて据え置きでよいか
- [ ] `issue-planner` はチャットでの対話起動のみでよいか、それとも将来的にSlack/メール等からの起票も受け付けたいか（11章冒頭参照）
- [ ] カテゴリ判定でUI/ロジックのどちらとも取れるグレーゾーンの指摘が出た場合のデフォルト振り分け先（11章参照）

---

## 10. 深層思考Issue作成サブエージェント（`issue-planner`）

### 位置づけ

既存の5エージェントは「Issueが既にある/指示が具体化されている」ことを前提にしていた。`issue-planner` はその**手前**、「ユーザーが雑な指示を出しただけ」の状態から始まる新しい入口。`issue-picker`（4章、既にあるIssueを拾う）とは役割が逆であることに注意。

```
ユーザー: 「〇〇の一覧表示が遅いから直して」（雑な指示）
  → issue-planner が起動
  → 目的・背景・実装方針・影響範囲・テスト要件・エッジケースを整理
  → gh issue create（ラベルは付けない。スコープ評価は本文に推奨として記載）
  → 人間が内容を見て auto-pickup ラベルを付与すれば issue-picker が後続を自動で拾う
```

### エージェント定義（`.claude/agents/issue-planner.md` として新設する想定）

```yaml
---
name: issue-planner
description: ユーザーの生の指示（まだGitHub Issue化されていない要望・不具合報告）を受け取り、目的・背景・実装方針・影響範囲・テスト要件・エッジケースまで深く考え抜いた上で `gh issue create` でIssueを作成する。Use this proactively at the very START when the user gives a raw instruction that has not yet been turned into a GitHub Issue.
tools: Read, Grep, Glob, Bash
model: opus
---
```
- `model: opus` を推奨する理由: 他4エージェント（sonnet）と違い、ここは「深く考え抜く」こと自体が仕事。実装や機械的なチェックではなく設計判断の質が成果物の質に直結するため

### 手順

1. ユーザーの指示を読み、**目的**（何を達成したいか）と**背景**（なぜ今それが必要か）を言語化する。指示が曖昧な場合は、指示文だけで判断せず既存コード（`Grep`/`Read`）から意図を補強する
2. 影響範囲調査: 変更が波及するファイル・API・DBスキーマ・既存の集約ロジック（`approve.ts`/`evolution.ts`/`xp.ts` 等）を `Grep`/`Glob` で洗い出す
3. 実装方針を検討する。複数のアプローチが考えられる場合は比較し、推奨案を1つ決める（決めきれない場合は Issue 本文に選択肢を残し、次項の「大きい変更」扱いにする）
4. テスト要件・**境界値/エッジケース**を列挙する（CLAUDE.md の TDD 規約に合わせ、test-writer がそのまま使える粒度で書く）
5. **スコープ評価**（重要、6章の安全装置と直結。**ラベルは付けない、あくまで推奨を書くだけ**）:
   - 影響範囲が限定的・実装方針が一意に決まる → Issue本文に「自動着手向きと判断」と理由を書く
   - 破壊的変更・認証/決済/インフラに関わる・実装方針が複数考えられ一意に決めきれない → Issue本文に「自動着手非推奨」と理由を書く
6. 以下のテンプレートで Issue 本文を組み立て、`gh issue create --title "..." --body-file <tmp>` で作成する。**`auto-pickup` ラベルは付けない**
7. 作成した Issue の URL とスコープ評価を報告する

**なぜスコープが限定的でも自動でラベルを付けないか**: 2章の安全装置は「`auto-pickup` は必ず人間が付ける（自動分類・自動判定はしない）」と定めている。`issue-planner` 自身がスコープ判定の結果として `auto-pickup` を付与すると、この安全装置をIssue作成の入口で迂回してしまう（実質的に「AIがスコープを自己判定してAIが自動着手を許可する」ことになり、人間の承認が形骸化する）。スコープ評価はあくまで人間向けの推奨情報として本文に残し、ラベル付与という実際の着手許可行為は常に人間の操作に委ねる（Codexレビューで指摘され、2026-08-11 に設計・実装とも修正）

### Issue本文テンプレート

```markdown
## 目的
<何を達成したいか、一文>

## 背景
<なぜ今必要か。ユーザーの元の指示もここに引用>

## 実装方針
<推奨アプローチ。複数案あった場合は比較を残す>

## 影響範囲
- <変更が波及するファイル/モジュール>

## テスト要件
- [ ] <正常系>
- [ ] <境界値・エッジケース>

## エッジケース
- <考慮した特殊ケース>

## 自動着手について
<「自動着手向きと判断: <理由>」または「自動着手非推奨: <理由>」>
```

### やってはいけないこと

- 指示をそのまま右から左に Issue 本文へコピーしない（「深く考え抜く」ことがこのエージェントの存在意義）
- **`auto-pickup` ラベルを自分で付けない**。スコープが限定的だと判断した場合でも、それはあくまで人間への推奨であり、実際の着手許可（ラベル付与）は常に人間に委ねる（2章の安全装置を参照）
- Issue作成のついでにコードを触らない（実装は `issue-picker` 以降の仕事）

---

## 11. 指摘カテゴリ別ルーティング（Claude Code純正）

### 設計方針

UI/ロジック・パフォーマンス/QAの3種類の専用エージェントを新設する**のではなく**、既存の `implementer`（必要なら `test-writer`）に**カテゴリ別の追加コンテキスト断片**を注入する方式にする。

理由: プロジェクト規約チェック（承認ロジック集約・XP計算・進化ロジック・ステータス遷移など、`code-reviewer.md` のレビュー観点）は全カテゴリ共通。エージェント自体を3分割すると規約チェックのロジックが3箇所に重複し、CLAUDE.mdの「1ファイル1責務」原則（`src/lib/` のモジュール分割ルールと同じ発想）に反する。呼び出し元がテキストで指摘内容を読んでカテゴリを判定し、`Agent` 呼び出し時のプロンプトに「重点確認事項」を混ぜ込むだけで済む。新しいツールや外部スクリプトは不要。

### カテゴリと判定基準（例）

| カテゴリ | 判定キーワード例 | 追加で参照させるドキュメント | 重点確認事項 |
|---------|-----------------|---------------------------|-------------|
| UI/デザイン | レイアウト、CSS、コンポーネント分割、トンマナ、アクセシビリティ、レスポンシブ | `docs/資料系/design-tone-and-manner.md`、`src/components/` 配置規約（CLAUDE.md） | 子供画面/親画面のトンマナ差、500行超のページはフォーム/モーダル抽出を検討したか |
| ロジック/パフォーマンス | N+1、計算量、非効率なクエリ、リファクタ、集約ロジック逸脱 | `src/lib/` モジュール分割規約、XP・進化ロジックのインポート先表（CLAUDE.md） | `approve.ts`/`evolution.ts`/`xp.ts` 経由になっているか、手書きロジックで規約を再実装していないか |
| QA/テスト・型・バグ | テスト不足、型エラー、境界値漏れ、ステータス遷移違反 | CLAUDE.md ステータス遷移表、`src/__tests__/` 命名規約 | 境界値テストの有無、`getUTCDay()` 等の日付規約違反 |

どのカテゴリにも明確に当てはまらない指摘（設計相談・質問系）は、既存の `/codex-followup` Step 5「意見・質問系」の分岐（コード変更不要、コメント返信のみ）をそのまま使う。

### 実装箇所

新しいコマンドは作らず、既存の `/codex-followup`（`.claude/commands/codex-followup.md`）の **Step 5「指摘への対応」** を拡張する形にする:

1. 「コード修正が必要」と判定された指摘それぞれについて、指摘本文を上記キーワード表に照らして**カテゴリ判定**を行う（`/codex-followup` 自体が会話的にテキストを読んでいるので、追加ツール無しで自然言語判断できる）
2. 判定したカテゴリの「追加で参照させるドキュメント」「重点確認事項」を、`implementer` を呼び出す際のプロンプトに追記する
3. QAカテゴリでテスト不足が明確な場合のみ、`implementer` の前に `test-writer` を呼んで Red を追加してから進める（CLAUDE.md の TDD 規約通り）。UI/ロジックカテゴリでは既存テストの Green 維持を確認すれば足りることが多いので、指摘内容から判断する
4. 以降（`code-reviewer` による承認、反復上限3回、pushなど）は既存の Step 5/6 の流れをそのまま使う

`issue-picker` 側の初回実装ループ（4章 Step 5）では、まだ Codex の指摘が存在しない（初回実装なので）ため、このカテゴリ判定は**発生しない**。カテゴリ判定が意味を持つのは PR作成後、Codex レビューへの対応フェーズ（`/codex-followup`）のみ。

### やってはいけないこと

- カテゴリ判定のために新しいエージェント定義やツールを増やさない（プロンプト注入で十分）
- グレーゾーンの指摘（UIともロジックとも取れる）で判定に迷って処理を止めない。デフォルトは「QA/テスト・型・バグ」寄りに倒す（安全側: テストで担保されていれば誤修正のリスクが下がるため）。この既定動作自体は9章の未決事項として最終確認する

---

## 12. 実機検証ログ（Step 0-8 手動実行、2026-08-11）

`/issue-picker` の手順（4章）を Issue #15 に対して手動実行し、Step 0〜8が通しで動くか検証した。

### 結果

- 対象Issue: [#15](https://github.com/km-copepoda/adhd/issues/15)（`.gitignore` に `__pycache__/` を追加する軽微な変更）
- worktree作成 → `policy-checker`（OK） → TDD実装（Red→Green、1反復で `code-reviewer` APPROVED相当） → `pr-submitter`（PR作成・`@codex review` 投稿） → ラベル更新・worktree破棄まで、**手順としては最後まで通った**
- 作成PR: [#16](https://github.com/km-copepoda/adhd/pull/16)

### 発見した課題（要対応）

1. **`Agent` ツールが既存サブエージェントを認識しない → 原因判明・解決済み**
   - このセッションの `Agent` ツールは、セッション中に新規作成した `issue-planner` は subagent_type として認識したが、セッション開始前から存在していた `policy-checker`/`test-writer`/`implementer`/`code-reviewer`/`pr-submitter` は `Agent type not found` で呼び出せなかった
   - 切り分けの結果、**`.claude/agents/` の既存5ファイルが UTF-8 BOM付き・CRLF改行（Windows形式）で保存されていたことが原因**と判明した。BOMを除去してLF改行に正規化したところ、次のターンで5エージェントとも正しく認識されるようになった（中身は無変更、エンコーディングのみ修正）
   - 検証手順: BOM付きのままコピーした場合は認識されず、BOM/CRLFを除去したファイルは（変更を加えた次のターンで）認識された。ただし「新規/変更ファイルは次ターンで拾われる」という反映タイミングの挙動そのものも今回判明した仕様で、これ自体もwebhook設計（即時性の見積もり）に影響する
   - **対応済み**: 5ファイルとも BOM除去・LF化を実施（2026-08-11）。以後 `.claude/agents/` 配下に新規ファイルを追加する際は、BOM付きで保存するエディタ/ツール（PowerShellの `Out-File` 等はデフォルトでBOM付与）を避けるか、保存後に忘れず正規化すること
   - **未解決の点**: このチャットセッション固有の `Agent` ツールの挙動であり、実際に自動化を実行する環境（`schedule` スキルのクラウドルーティン、または実機の `claude` CLI）で同じBOM起因の問題が起こるかは別途確認が必要。ただし原因と対処法が判明したので、起きた場合の対応（BOM除去）は明確
   - 対応: 8章の実装チェックリストを更新済み

2. **`code-reviewer`/`implementer` の lint チェックが機能していなかった**
   - リポジトリ全体の `npm run lint` は、今回の変更と無関係な既存エラーが約1700件あり常にFAILする状態だった
   - `code-reviewer.md` / `implementer.md` の元の記述は「`npm run lint` の結果を見る」という曖昧な指示で、厳密に適用すると**どんな変更でも常にCHANGES_REQUESTED相当になってしまう**欠陥があった
   - **対応済み**: `.claude/agents/code-reviewer.md` と `.claude/agents/implementer.md` を修正し、lintは変更したファイルのみ（`npx eslint <変更ファイル...>`）を対象にする方式に変更した（2026-08-11）。これは Issue自動着手パイプラインに限らず既存の通常フロー（対話セッションでの実装）にも影響する修正のため、別途 `docs/decisions.md` への追記を検討してよい

### 未検証のまま残っている部分

- `/codex-followup` によるPR #16のレビュー反復（Codexが実際にコメントを付けてから動かしていない）
- カテゴリ別ルーティング（11章）の実際の判定精度
- Step 0（マージ検知→Issueクローズ）— まだマージされたPRが無いため未検証
- `auto:blocked` への遷移パス（policy-checker衝突時・反復上限到達時）
