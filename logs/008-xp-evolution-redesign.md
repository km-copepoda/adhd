# 008: XP値変更・進化システムリセット仕様・モンスター名=ユーザー名

## 概要
v5/v6設計書に基づいてXP値、進化システムを大幅改修。モンスター名をユーザー名として扱う方針を確定。

## 変更内容

### 1. XP値変更
- **変更前:** EASY=20, NORMAL=40, HARD=80
- **変更後:** EASY=10, NORMAL=15, HARD=20
- 対象ファイル: `src/lib/constants.ts` (XP_MAP)

### 2. 進化システム（ポイントリセット付き）
- **変更前:** レベル制（合計ポイント÷10=レベル）。進化閾値: Lv5, Lv15, Lv30。ポイントは蓄積。
- **変更後:** ステージ制（進化段階をDBに保存）。進化閾値到達でポイントが0にリセット。
  - ステージ0→1: 10pt必要
  - ステージ1→2: 30pt必要
  - ステージ2→3: 70pt必要
  - ステージ3: 最終形態（進化なし）

#### 変更ファイル
- **`prisma/schema.prisma`**: Userモデルに `evolutionStage Int @default(0)` フィールド追加
- **`src/lib/constants.ts`**:
  - `MONSTER_STAGES`: `minLevel` → `ptToEvolve`（進化に必要なポイント, 最終形態はnull）
  - `computeLevel()` 関数を削除
  - `getMonsterStage(side, evolutionStage)`: ステージインデックスで取得するように変更
  - `checkEvolution()` 関数を新規追加: 進化判定＋リセット後のポイント値を返す
  - `getXpInfo()`: 引数に `evolutionStage` 追加、レベル表示→進化ゲージ表示に変更
- **`src/app/api/approve/[id]/route.ts`**:
  - childのinclude追加（現在のポイントを取得するため）
  - ポイント加算後に `checkEvolution()` で進化判定
  - 進化時はポイントを0にリセットし、`evolutionStage` をインクリメント
  - レスポンスに `evolved` フラグ追加
- **`src/app/api/monster/route.ts`**: レスポンスに `evolutionStage` 追加
- **`src/app/child/monster/page.tsx`**:
  - `MonsterData`型に `evolutionStage` 追加
  - Lv表示を削除、進化ゲージ（ステージ内のポイント進捗）に変更
  - 最終形態の場合は「最終形態」テキスト表示
  - 次の進化ヒントにモンスター名を追加表示

### 3. モンスター名=ユーザー名
- `monsterName`フィールドをユーザー名として扱う方針を確定
- コード上は既に `monsterName || name` の優先順位で表示していたため、大きな変更なし
- 子どものアカウント作成時（親が行う）に `monsterName` を設定する流れ

## 矛盾チェック
- 過去のログ（001〜007）と矛盾なし
- v5設計書のLv1(10pt), Lv3(30pt), Lv7(70pt), Lv15(150pt) に近い閾値を採用（10, 30, 70）
  - 最終進化のv5の150ptは削除（ステージ3は最終形態として進化なし）

## ビルド確認
- `npx next build` 成功（エラーなし）
