---
description: 現在ブランチの PR に付いた Codex レビューを 1 反復処理する。`/loop /codex-followup` で反復実行できる。
---

# codex-followup

現在ブランチの PR に対して Codex レビューを **1 反復** 処理する。`/loop /codex-followup`（動的ペース）または `/loop 5m /codex-followup`（5分固定）で反復実行する。

## 前提

- Codex はユーザー名 `chatgpt-codex-connector[bot]` で GitHub にコメントする
- gh CLI は `"C:\Program Files\GitHub CLI\gh.exe"` を PowerShell から呼ぶ
- 反復ごとに 1 コミット以下、原則 3 反復以内で完了

## 手順

### 1. PR 特定
```powershell
& "C:\Program Files\GitHub CLI\gh.exe" pr view --json number,url,state
```
- PR が無い / MERGED / CLOSED → 「PR 無しのため終了」と報告し、**ScheduleWakeup を呼ばない**

### 2. コメント履歴取得
```powershell
& "C:\Program Files\GitHub CLI\gh.exe" api repos/{owner}/{repo}/issues/{num}/comments
```
- `user.login == "chatgpt-codex-connector[bot]"` を Codex コメントとする
- `body` に `@codex review` を含み、`user.login` が PR 作者と一致するコメントを **iteration marker** とする

### 3. 反復回数チェック
- iteration marker 数 >= 4（初回 + 3 回追加）→ 「反復上限（3 回）に達したので終了」と報告、**ScheduleWakeup を呼ばない**

### 4. Codex 最新コメント判定
- 最後の iteration marker より **後** に投稿された Codex コメントを取得
- **無い場合** → 「Codex 未レビュー」と報告、**約 300 秒後に ScheduleWakeup**（キャッシュ効率のため 270 秒推奨）
- **ある場合**、内容を判定:
  - LGTM 系（例: `Didn't find any major issues` / `LGTM` / `You're on a roll` / `問題ありません` / `特に指摘` / `Approved`）のみ → 「Codex 承認」と報告、**ScheduleWakeup を呼ばない**
  - 具体的な指摘あり → ステップ 5 へ

### 5. 指摘への対応
各指摘を分類して処理:

- **コード修正が必要**:
  - `policy-checker` サブエージェントで CLAUDE.md / decisions.md との衝突を確認
  - 衝突があれば修正せず、`gh pr comment <num> --body "..."` で理由を日本語で返信
  - 衝突なければ `implementer` → `code-reviewer` サブエージェントで修正 → 現ブランチにコミット + push
- **意見・質問系（コード変更不要）**:
  - `gh pr comment <num> --body "..."` で日本語で返信

### 6. 再レビュー依頼
- **実コード修正が入った場合のみ** `gh pr comment <num> --body "@codex review Please review in Japanese."` を投稿
- 返信のみで済んだ場合は再依頼しない（Codex が同じことを繰り返し指摘する可能性）

### 7. 次の wakeup
- 上記いずれの終了条件にも該当しない → `ScheduleWakeup(delaySeconds=300)` で次反復を予約（prompt に `<<autonomous-loop-dynamic>>` を渡す）
- 終了条件に該当 → ScheduleWakeup を呼ばない

## 出力フォーマット

```
### 反復 N/3 (PR #<num>)
- URL: <PR URL>
- Codex 最新コメント: <要約 or 「未レビュー」>
- 対応: [修正 X ファイル / 返信 Y 件 / 対応なし]
- 次回: [<M> 秒後に wakeup 予約 / 終了 (<理由>)]
```

## やってはいけないこと

- CLAUDE.md / docs/decisions.md の規約に反する変更を Codex 指摘に従って入れない（変更せず理由を返信）
- 元の PR 目的から外れる新機能追加を「ついでに」やらない（別 PR にする）
- 反復上限を超えて自動継続しない
- Codex がまだレビュー中に催促・再依頼しない（wakeup を待つ）
- Codex のコメントが 1 件も無い状態でこのコマンドが呼ばれたら「そもそも @codex review が呼ばれていない」と判断して終了
