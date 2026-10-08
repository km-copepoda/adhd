---
name: theme-set-import
description: モンスターテーマセット（妖怪・ドラゴン・仏像などの買い切りセット）の元PNG画像を webp(256px/q85)に変換し、public/monsters/<theme>/ へ配置して、src/lib/monsterThemes/<theme>.ts（名前・説明・ひらがな版つき39体+卵のテーブル）を生成しレジストリに登録するスキル。「テーマ画像をwebpにして組み込んで」「妖怪セットを取り込んで」「新しいテーマセットを追加したい」「docs/キャラクター/〜セット の画像をプロジェクトに入れて」など、テーマセット画像のデータ化・組み込みの話が出たら、テーマ名を明示していなくても必ずこのスキルを使うこと。
---

# theme-set-import

`docs/キャラクター/<XXX>セット/` に置いた元画像（PNG）を、アプリのテーマデータとして組み込む。
名前・説明・パスの正本は、元画像フォルダに `テーマ.txt` があればそれ（パス,名前,モチーフ,説明 のカンマ区切り表。仕様書 md より新しいことがあり、Stage3 のパス割り当てや説明文が変わっている）、なければ `docs/未実装仕様書/monster-theme-sets.md`。両者が食い違うときは `テーマ.txt` を優先する。既存の実装例は 既存の実装例は `buddha`（`src/lib/monsterThemes/buddha.ts`）。

1セット = 卵1 + 39体（Stage1×3 + Stage2×9 + Stage3×27）。進化ロジック・パスキー（`STUDY_STAMINA_LIFE` など）は既定テーマと共通で、差し替わるのは画像・名前・説明だけ。

## 担当範囲

やること: webp変換 → public配置 → 影画像生成 → TSテーブル生成（かな版含む）→ レジストリ登録 → テスト。
やらないこと: 購入導線・Prisma・課金まわり（有料テーマは `isFree: false` で登録するだけ。選択可否は既存の `FamilyMonsterTheme` 機構に任せる）。ドット絵版など別バリエーションの取り込み。

## 進め方

CLAUDE.md の開発フロー（`main` から直接作業せず `feature/` ブランチ、TDD、テスト通過後にコミット）に従う。`src/` のロジック追加なので `policy-checker` → `test-writer` → `implementer` → `code-reviewer` の流れに乗せてよい。以下は作業内容の手順。

### 1. 入力を確定する

次の3つを、指示から読み取れなければユーザーに聞く。

- テーマID（英小文字。例 `yokai`。仕様書の見出しの括弧内、`## 7. にほんようかいセット（yokai）`）
- 名前・説明の出典（`<元画像フォルダ>/テーマ.txt` の有無を確認。あればそれを使う）
- 元画像フォルダ（例 `docs/キャラクター/妖怪セット`）
- 仕様書のセクション（名前・説明の出典）

### 2. 元画像をリネームする（名前だけのファイルの場合）

元画像が `なまはげ.png` のように名前だけなら、正本（`テーマ.txt`、なければ仕様書 md）のパス列を使って `勉体生_名前.png` に変える。仕様書の「名前」列と「モチーフ」列（漢字表記）をファイル名（拡張子なし）と完全一致で突き合わせる。

```bash
node .claude/skills/theme-set-import/scripts/rename-by-spec.mjs --spec "<元画像フォルダ>/テーマ.txt" --src "<元画像フォルダ>" [--alias 名前=パス]...
```

`--spec` に md を渡すときは `--theme <id>` も必要。既定は dry-run（対応表を表示するだけ）。対応表をユーザーに見せて了承を得てから `--apply` を付けて実行する。ファイル名を変える操作なので、了承前に `--apply` しない。

- 仕様書にない表記のファイル（Stage1 は仕様書がひらがなだけで、`人魂` `小オニ` `座敷童` のように漢字・カタカナ違いになりやすい）は「仕様書と不一致」と出る。`--alias 人魂=STUDY` のように補う。どのファイルがどのパスかはキャラクターの説明から判断し、迷う場合はユーザーに聞く
- 曖昧・衝突・仕様書にあるのに画像が無い行があれば、`--apply` でもリネームせず終了する
- すでに `勉体生_` 形式のファイル、卵、`不要_`、サブフォルダは触らない

### 3. 元画像の命名を検証する（dry-run）

```bash
node .claude/skills/theme-set-import/scripts/convert-theme-images.mjs --theme <id> --src "<元画像フォルダ>" --dry-run
```

元画像は仏像セットと同じ `勉体生_名前.png`（勉=STUDY 体=STAMINA 生=LIFE。Stage1 は `勉_名前.png`）にリネーム済み（ステップ2）の前提。卵は接頭辞なしで「たまご」を含む名前。
スクリプトは 39体+卵が揃っていないと変換を中止し、次を一覧で報告する。

- **要リネーム**: パスが決まらないファイル（名前だけのファイル等）
- **不足 / 重複**: 埋まっていないパス、同じパスに複数ファイル
- **対象外**: サブフォルダ（`ドットver` `ドット化するやつ` 等）と `不要_` 接頭辞のファイル。これらは意図的に変換しない

リネームはユーザーの作業なので勝手にやらない。報告を見せて、リネーム待ちにする。仕様書の名前と実ファイル名が食い違っている場合（仕様にない妖怪の画像がある等）も、どちらを正とするか聞く。

### 4. 変換して配置する

dry-run が通ったら `--dry-run` を外して実行する。出力は `public/monsters/<id>/<パスキー>_<名前>.webp` と `egg.webp`（256×256 に contain で収め、背景は透過、webp quality 85）。全テーマ同じ設定に揃えるための固定値なので、変えない。

### 4b. 影画像を生成する

図鑑の未取得表示は `/monsters/` を `/monsters/shadow/` に置換した画像を読む（`ZukanEggSection.tsx` / `ZukanEvolutionBranch.tsx`）。`public/monsters/shadow/<id>/` が無いと子供画面の図鑑で影が404になるので、ステップ4の直後に必ず生成する。

```bash
python scripts/gen_shadow.py <id>
```

不透明部分を暗紫色 (25, 20, 50) で塗った webp を、元画像と同じファイル名（卵 `egg.webp` 含む40枚）で出力する。引数なしだと dark / light / yokai が対象になる。buddha の影は別途生成済みなので、新テーマは必ずテーマIDを引数で渡す。

### 5. 名前・説明データ（JSON）を作る

仕様書のセクションから、卵 + 39体分の JSON を作業用の場所（スクラッチパッド等。リポジトリには残さない）に書く。形式は `scripts/gen-theme-ts.mjs` の冒頭コメントを参照。

- `name`: 表示名。仕様書に漢字などの表記列（Stage2/3 の「モチーフ」列）があればそれ、なければ名前列そのまま
- `nameKana`: 名前のひらがな読み。仕様書の名前列がひらがななのでそれを使う
- `description`: 仕様書の説明文そのまま
- `descriptionKana`: 説明文の**ひらがな版**。ここは Claude が作る。漢字・カタカナは読みに直して全部ひらがなにし、句読点・「」・記号・文の切れ目は元のまま残す（buddha.ts の descriptionKana が手本）。固有名詞や地名の読み（例: 大江山→おおえやま）は誤りやすいので、自信のないものは最後にユーザーへ列挙して確認する

パス表記の対応: 仕様書の `S→St` `S_St_L` は、`STUDY_STAMINA` `STUDY_STAMINA_LIFE` のこと（S=STUDY, St=STAMINA, L=LIFE）。書き間違えやすいので、キーは Stage ごとに機械的に組み立てて仕様書の行と突き合わせる。

### 6. テストを先に書く（Red）

`src/__tests__/lib/monsterThemes/buddha.test.ts` を手本に `<id>.test.ts` を作る。最低限:
- 39キー、既定テーマとキー集合が一致、Stage1/2/3 の全パスが存在
- 全エントリで `image`/`name`/`nameKana`/`description`/`descriptionKana` が空でない
- `image` が `/monsters/<id>/` 配下、かつ `public/` に**実ファイルとして存在する**（`fs.existsSync`）
- `nameKana`/`descriptionKana` に漢字・カタカナが残っていない（`/[一-鿿゠-ヿ]/` に一致しない。「ー」は許可）
- 卵の `image` が `/monsters/<id>/egg.webp`
- 全エントリと卵について、`image` の `/monsters/` を `/monsters/shadow/` に置換したファイルが `public/` に実在する（影画像の生成漏れ検知）

`src/__tests__/lib/monsterThemes/registry.test.ts` には「dark/light/buddha の3テーマ」を前提にした厳密比較があるので、新テーマ追加に合わせて更新する。この時点で `npm test` が失敗することを確認する。

### 7. TSテーブルを生成する（Green）

```bash
node .claude/skills/theme-set-import/scripts/gen-theme-ts.mjs --theme <id> --data <data.json>
```

`image` は実在する webp のファイル名から機械的に決まる。データの不足・空欄・画像との不整合があれば生成前にエラーになるので、内容を直してやり直す。既存ファイルは `--force` なしでは上書きされない。

### 8. レジストリに登録する（2か所）

buddha と同じ2か所に追加する。片方だけだと `getMonsterStage` と一覧表示が食い違う。

1. `src/lib/monsterThemes/index.ts` の `MONSTER_THEMES`: `id` / `label` / `description` / `thumbnail`（STUDY エントリの image）/ `eggImage` / `table` / `isFree: false`
2. `src/lib/monsters.ts` の `THEME_ENTRIES`: `{ table, egg }`（循環参照を避けるため index.ts を経由せず直接 import する。ファイル内のコメント参照）

### 9. 検証する

- `npm test` が全部通ること（新規テスト含む）
- `npx tsc --noEmit` で型エラーがないこと
- `public/monsters/shadow/<id>/` に40枚あり、ファイル名が `public/monsters/<id>/` と一致すること
- `public/monsters/<id>/` の合計サイズを報告する（元PNGは1枚1MB超。256px webp化で大きく縮む想定）
- 生成された `nameKana` / `descriptionKana` から数件をサンプルして、ユーザーに読み違いがないか見てもらう

### 10. 報告

変換した枚数、対象外にしたファイル、追加・変更したファイル、確認が必要な読み（かな）を簡潔に報告する。コミットは CLAUDE.md の完了報告ルールに従う（`docs/` の元画像はこのスキルの成果物ではないのでステージングしない）。
