-- Issue #93: monsterLevels のテーマ名前空間対応 — 既存DB(collectedPaths/monsterLevels)の
-- 一括変換マイグレーション。
--
-- collectedPaths (JSON配列文字列) と monsterLevels (JSON文字列 {path: count}) について、
-- 名前空間の付いていない旧形式エントリを、各ユーザーの side から導出したテーマ
-- (LIGHT → "light"、それ以外（DARK/null）→ "dark") で "{themeId}:{path}" 形式に変換する。
-- 既に "dark:"/"light:"/"buddha:" のいずれかで始まる要素・キーはそのまま維持する。
--
-- 冪等性: 既に名前空間付きの要素・キーはそのまま素通りするため、本SQLは何度実行しても
-- 結果が変わらない。
--
-- NULL または空 ("[]"/"{}") の行は対象外（変換不要のため WHERE 句で UPDATE 自体をスキップする）。

-- collectedPaths: JSON配列の各要素を変換する。
-- WITH ORDINALITY で元の並び順を維持したまま jsonb_agg に渡す。
UPDATE "User"
SET "collectedPaths" = (
  SELECT jsonb_agg(
           CASE
             WHEN elem LIKE 'dark:%' OR elem LIKE 'light:%' OR elem LIKE 'buddha:%' THEN elem
             ELSE (CASE WHEN "User"."side" = 'LIGHT' THEN 'light' ELSE 'dark' END) || ':' || elem
           END
           ORDER BY ord
         )::text
  FROM jsonb_array_elements_text("User"."collectedPaths"::jsonb) WITH ORDINALITY AS t(elem, ord)
)
WHERE "collectedPaths" IS NOT NULL
  AND "collectedPaths" NOT IN ('[]', '');

-- monsterLevels: JSONオブジェクトの各キーを変換する。
-- 変換後のキーが衝突するケース（例: 新形式で書かれた最新の記録と、未変換の旧形式キーが
-- 同じ変換先を指す場合）に備え、旧形式由来のエントリを先、既に名前空間付きだったエントリを
-- 後に処理させる。jsonb_object_agg は重複キーの場合「最後に処理された値」を採用する仕様の
-- ため、結果的に既に名前空間付きだった（＝新しい）値が優先される。
UPDATE "User"
SET "monsterLevels" = (
  SELECT jsonb_object_agg(
           CASE
             WHEN key LIKE 'dark:%' OR key LIKE 'light:%' OR key LIKE 'buddha:%' THEN key
             ELSE (CASE WHEN "User"."side" = 'LIGHT' THEN 'light' ELSE 'dark' END) || ':' || key
           END,
           value
           ORDER BY (CASE WHEN key LIKE 'dark:%' OR key LIKE 'light:%' OR key LIKE 'buddha:%' THEN 1 ELSE 0 END)
         )::text
  FROM jsonb_each("User"."monsterLevels"::jsonb)
)
WHERE "monsterLevels" IS NOT NULL
  AND "monsterLevels" NOT IN ('{}', '');
