# 子供画面 トンマナ（トーン＆マナー）規約

作成日: 2026-05-29

## 世界観

ダークファンタジーRPG風。冒険・モンスター育成をテーマにした暗い背景にゴールドの差し色。
子供にとって「自分だけの冒険の画面」という特別感を演出する。

---

## 1. カラーパレット

### 基本パレット（必ずこれを使う）

| 用途 | 変数 | 値 | 備考 |
|------|------|----|------|
| 背景 | `quest-bg` | `#07080f` | 最も暗い。ページ背景 |
| カード | `quest-card` | `#131828` | カード・モーダルの背景 |
| ボーダー | `quest-border` | `#1e2540` | カード枠・区切り線 |
| アクセント | `quest-gold` | `#f0c040` | 主要アクション・見出し・強調 |
| ゴールド暗 | `quest-gold-dark` | `#c9973a` | グラデーション用 |
| テキスト | `quest-text` | `#e8e4d8` | 本文テキスト |
| テキスト薄 | `quest-dim` | `#555a72` | 補足・非アクティブ |

### パラメータカラー（STUDY/STAMINA/LIFE専用）

| パラメータ | 色 | 用途 |
|-----------|-----|------|
| STUDY | `#60a5fa`（青） | 知力系の進捗・ゲージ |
| STAMINA | `#f87171`（赤） | 体力系の進捗・ゲージ |
| LIFE | `#4ade80`（緑） | 生活系の進捗・ゲージ |

### 特殊カラー（用途を限定して使用）

| 用途 | 色 | 使ってよい場面 |
|------|-----|---------------|
| 転生 | `#7e22ce`〜`#a855f7`（紫グラデ） | 転生UI・転生関連テキストのみ |
| エラー | `#f87171`（赤） | エラーメッセージ・差し戻し状態 |
| 成功 | `#4ade80`（緑） | 承認済み・完了状態 |

### 禁止

- **ライト系の背景色を使わない**（`bg-blue-100`, `bg-purple-100`, `bg-gray-300` 等）
- **`text-white` を使わない** → `text-quest-text` を使う
- **Tailwindのデフォルトカラーを直接使わない** → 必ずquestパレットかパラメータカラーを使う

---

## 2. タイポグラフィ

### フォント

| 用途 | フォント | 変数 |
|------|---------|------|
| 本文 | Noto Sans JP (400, 700) | `--font-sans` |
| 見出し・装飾 | Cinzel (700) | `--font-serif` |

### サイズ規約

| 用途 | クラス | 備考 |
|------|--------|------|
| ページタイトル | `font-serif text-xl text-quest-gold tracking-wider` | Cinzelで装飾的に |
| セクション見出し | `text-sm font-bold tracking-wider` | |
| 本文 | `text-sm` | デフォルト |
| 補足・メタ情報 | `text-xs text-quest-dim` | |
| 極小ラベル | `text-[10px]`〜`text-[11px]` | BottomNavラベル、バッジカウント等のみ |

---

## 3. コンポーネント標準

### カード

```
bg-quest-card border border-quest-border rounded-xl p-4
hover:border-quest-gold/30 transition-all
```

### ボタン（主要アクション）

```
bg-quest-gold text-quest-bg font-bold rounded-lg py-2.5 px-5
```

### ボタン（副次アクション）

```
border border-quest-border text-quest-dim rounded-lg py-2.5 px-4
hover:text-quest-text transition-colors
```

### ボタン（disabled）

```
disabled:opacity-40 disabled:cursor-not-allowed
```
※ `disabled:bg-gray-300` は禁止

### ピル型フィルター/タブ

```
rounded-full border border-quest-border px-3 py-1 text-sm
// アクティブ時
border-quest-gold/50 bg-quest-gold/10 text-quest-gold
```

### モーダル/オーバーレイ

```
// 背景
bg-black/70 fixed inset-0 z-[60]
// コンテンツ
bg-quest-card rounded-2xl shadow-2xl p-6
```

### 角丸の使い分け

| 要素 | 角丸 |
|------|------|
| カード | `rounded-xl` |
| ボタン | `rounded-lg` |
| モーダル | `rounded-2xl` |
| ピル/タグ | `rounded-full` |

---

## 4. テキストの口調

### 基本ルール

- **カジュアルで励ます口調**（「〜だよ」「〜しよう！」「がんばれ！」）
- **敬語（です/ます）は使わない** → エラーメッセージも含めてカジュアルに統一
- **RPG用語を使う**（クエスト、承認、XP、進化、転生）

### OK例

```
タスクをタップして報告しよう！
あと3個！がんばれ！
今日やるって決めたね！
エラーが起きちゃった。もう一回やってみてね
```

### NG例

```
タスクを報告してください        → 敬語
エラーが発生しました            → 敬語 + 堅い
報告に失敗しました。再度お試しください → 完全に大人向け
```

### 絵文字

- 見出し・ボタン・ステータス表示に積極的に使う
- ADHD児の視認性を助ける重要な要素として扱う
- ただし本文テキスト中に詰め込みすぎない

---

## 5. アニメーション

| 名前 | 用途 | 設定 |
|------|------|------|
| `float` | モンスター浮遊 | 3s ease-in-out infinite, ±8px |
| `shimmer` | プログレスバーの光沢 | 2s linear infinite |
| `pulse-once` | 承認スタンプ | 0.4s scale 0.5→1.2→1 |
| `successPop` | クエスト完了 | 0.5s cubic-bezier バウンス |
| `evolveIn` | 進化演出 | 0.5〜0.7s scale フェード |
| `rebirthPulse` | 転生ボタンの呼吸 | 1.5s box-shadow |

### 原則

- 報酬感・達成感を演出するために使う
- 0.3〜3秒の短い演出に留める（子供の注意を奪いすぎない）
- ループアニメーションはモンスター浮遊・プログレスバー等の控えめなものに限定

---

## 6. 現状の修正が必要な箇所

| ページ | 問題 | 対応 |
|--------|------|------|
| 宝箱（develop） | ライトカラー（`bg-blue-100`等）を使用 | ダークパレットに置き換え |
| 宝箱（develop） | `disabled:bg-gray-300` | `disabled:opacity-40` に変更 |
| 宝箱（develop） | ボタンが `rounded-full` | `rounded-lg` に統一 |
| ひろば | エラーが「ました」調 | カジュアル調に修正 |
| 各所 | `text-white` の使用 | `text-quest-text` に統一 |
| 各所 | ボタンpaddingがバラバラ | `py-2.5 px-5`（主要）/ `py-2.5 px-4`（副次）に統一 |
