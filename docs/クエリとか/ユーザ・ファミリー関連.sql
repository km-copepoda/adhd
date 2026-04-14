-- 特定ファミリーのメンバー一覧
SELECT u.id, u.name, u.role, u."childCode", u."evolutionStage", u."evolutionPath"
FROM "User" u
WHERE u."familyId" = '<family_id>';

-- 特定の子供の詳細（XP・進化条件）
SELECT id, name, "studyPt", "staminaPt", "lifePt",
       "evolutionStage", "evolutionPath", "collectedPaths", "monsterLevels",
       "rebirthPending", "rebirthEggBonus"
FROM "User"
WHERE id = '<user_id>';

-- ファミリーコードからファミリー+メンバー検索
SELECT f.id, f.code, u.id AS user_id, u.name, u.role
FROM "Family" f
JOIN "User" u ON u."familyId" = f.id
WHERE f.code = '<family_code>';