-- Issue #111: モンスターテーマ所持記録を子供単位(ChildMonsterTheme)から
-- 家族単位(FamilyMonsterTheme)へ移行する。
--
-- 背景: 親が購入したテーマは家族の子供全員が使えるべきであり、子供を追加するたびに
-- 個別付与が必要な現行設計はユーザー体験・運用コストの両面で問題があった
-- (docs/decisions.md 2026-08-18 決定の補足)。

-- 1. FamilyMonsterTheme テーブルを作成する。
CREATE TABLE "FamilyMonsterTheme" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantReason" TEXT NOT NULL,

    CONSTRAINT "FamilyMonsterTheme_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FamilyMonsterTheme_familyId_themeId_key" ON "FamilyMonsterTheme"("familyId", "themeId");
CREATE INDEX "FamilyMonsterTheme_familyId_idx" ON "FamilyMonsterTheme"("familyId");

ALTER TABLE "FamilyMonsterTheme" ADD CONSTRAINT "FamilyMonsterTheme_familyId_fkey"
    FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. データ移送: ChildMonsterTheme を User.familyId で JOIN して FamilyMonsterTheme へ INSERT する。
--    兄弟間で同じ themeId の複数レコードがある場合は DISTINCT ON (familyId, themeId) +
--    activatedAt ASC（最古のレコード）を採用し、ON CONFLICT DO NOTHING で重複作成を防ぐ。
--    familyId が NULL のユーザーに紐づくレコード（INNER JOIN で自然に除外される）は対象外。
--
-- NOTE: 本番の ChildMonsterTheme は 0 件であることを確認済みのため実データへの影響は無いが、
-- 将来の安全策としてロジック自体は正しく実装する。
INSERT INTO "FamilyMonsterTheme" ("id", "familyId", "themeId", "activatedAt", "grantReason")
SELECT DISTINCT ON (u."familyId", c."themeId")
       gen_random_uuid()::text, u."familyId", c."themeId", c."activatedAt", c."grantReason"
FROM "ChildMonsterTheme" c
JOIN "User" u ON u."id" = c."childId"
WHERE u."familyId" IS NOT NULL
ORDER BY u."familyId", c."themeId", c."activatedAt" ASC
ON CONFLICT ("familyId", "themeId") DO NOTHING;

-- 3. 旧テーブルを削除する。
DROP TABLE "ChildMonsterTheme";
