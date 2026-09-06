---
description: 設計ドキュメントをローカル codex CLI に渡し実現可能性をレビューさせる。要再設計なら設計に戻す（最大5反復）。
---

# codex-design-review

`policy-checker` が OK を返した後、`test-writer` / `implementer` に進む前に、**設計を凍結する前**の設計ドキュメントを別系統モデル（Codex）へ渡し「設計が既存コードと噛み合うか」を検証する。実装後の高コストな手戻りを防ぐのが目的。

実装後の PR レビュー反復（`/codex-followup`）とは別物。こちらは**コードを1行も書く前**の工程で、成果物は設計ドキュメントとレビュー記録のみ。

## 目的

設計凍結前に別系統モデル（Codex）で「設計が既存コードと噛み合うか」を検証し、設計ミスが実装完了後に高コストで発覚するのを防ぐ。実装者は Claude のまま（`implementer` を Codex に替えない）。

## 前提

- `codex` CLI がローカルにインストール済みであること。**無い場合はこの工程をスキップし、その旨を Issue にコメントして先へ進む**（パイプライン全体は止めない）
- `gh` は `"C:\Program Files\GitHub CLI\gh.exe"` を PowerShell から呼ぶ（`issue-picker.md` と同じ記法）
- 対象は `src/` のロジック変更・スキーマ（Prisma schema）変更を含むタスクのみ。**該当しなければ即終了**（1行バグ修正、ドキュメント/設定ファイルのみの変更、`.claude/` 配下のみの変更はスキップ）
- Issue 起点（`issue-planner` / `issue-picker` 経由）の場合も、設計提示・レビュー結果・再設計のやり取りはすべて対象 Issue 上で行う

## 手順

### 1. 設計ドキュメントを用意する

以下のセクションを持つ Markdown を用意する:

- 目的
- 背景
- 変更対象ファイル
- 実装方針
- 影響範囲
- 代替案検討

Issue 起点の場合は、この設計ドキュメントを対象 Issue にコメントとして投稿し記録を残す。

```powershell
$gh = "C:\Program Files\GitHub CLI\gh.exe"
& $gh issue comment <N> --body-file <設計ドキュメントのパス>
if ($LASTEXITCODE -ne 0) { throw "設計ドキュメントのIssueコメント投稿に失敗 (exit=$LASTEXITCODE)" }
```

### 2. codex CLI に設計レビューを依頼する

`codex` CLI に、次のプロンプトと設計ドキュメントを渡して非対話実行する:

> このリポジトリを調べ、次の設計の実現可能性をレビューせよ。既存コードとの整合性・規約(CLAUDE.md)との齟齬・見落とされた影響範囲・より単純な代替案を指摘せよ。日本語で回答。

Codex CLI の非対話実行サブコマンドは **`codex exec`**（Run Codex non-interactively）を使う。`codex exec review`（= `codex review`）というサブコマンドも存在するが、これは**既存のコード差分に対するコードレビュー用途**であり、まだコードが1行も無い設計レビューには不適。設計レビューでは生プロンプト（設計ドキュメント本文＋レビュー観点）を `codex exec "<プロンプト>"` に直接渡す。

起動コマンド例（確定形）:

```powershell
$repo = (& git rev-parse --show-toplevel)
$prompt = @"
$(Get-Content -Raw <設計ドキュメントのパス>)

--- レビュー依頼 ---
上記はこれから実装する設計です。このリポジトリを調べ、設計の実現可能性をレビューせよ。既存コードとの整合性・規約(CLAUDE.md)との齟齬・見落とされた影響範囲・より単純な代替案を指摘せよ。日本語で回答。
"@
$review = codex exec --cd $repo $prompt
if ($LASTEXITCODE -ne 0) { throw "codex 実行に失敗 (exit=$LASTEXITCODE)" }
$review | Set-Content -Encoding utf8 <レビュー結果の一時ファイル>
```

`codex` コマンド自体が見つからない場合は、この工程をスキップし Issue に「`codex` CLI 未導入のため設計レビューをスキップして実装へ進む」とコメントして終了する。

### 3. レビュー結果を Issue に記録する

```powershell
& $gh issue comment <N> --body-file <レビュー結果の一時ファイル>
if ($LASTEXITCODE -ne 0) { throw "レビュー結果のIssueコメント投稿に失敗 (exit=$LASTEXITCODE)" }
```

### 4. 指摘を分類する

- **実現可能・軽微な調整のみ** → Claude が設計を更新して凍結する。通常フロー（`test-writer` → `implementer`）へ進む
- **要再設計**（設計の前提が破綻、既存アーキテクチャと衝突） → Claude が設計をやり直し、**手順1へ戻る**

### 5. 反復上限

- 手順1〜4の反復は**最大5回**
- 5回で「実現可能」に収束しない場合は中断し、Issue にコメントして人間の判断を仰ぐ。`auto:blocked` ラベルが存在するリポジトリでは付与する

```powershell
& $gh issue edit <N> --add-label "auto:blocked"
& $gh issue comment <N> --body "設計レビューを5回反復しても実現可能な設計に収束しなかったため中断します。内容を確認してください。"
```

## やってはいけないこと

- `codex` CLI が無いことを理由にパイプライン全体を停止する（スキップして先へ進み、Issue に明記する）
- 反復上限5回を超えて設計レビューを回し続ける
- 設計レビューを口実に実装（コード編集）を始める。この工程の成果物は設計ドキュメントとレビュー記録のみ
- `src/` に変更が及ばないタスク（ドキュメント/設定のみ）で無理にこの工程を実行する
