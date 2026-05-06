-- ============================================================
-- 特定の子供のタスク検索クエリ
-- 注意: QuestInstance.date / TaskTemplate.targetDate などの @db.Date 型は
--       「JST 日付を UTC 0:00 として保存」する規約のため、
--       :today_jst には JST 当日（例: '2026-05-02'）を渡すこと。
-- ============================================================


-- ------------------------------------------------------------
-- 1) 特定の子供の「今日のタスク」一覧
--    src/app/api/quests/today/route.ts と同じ条件で取得する
--      - 当日の QuestInstance（テンプレートが有効なもの）
--      - もしくは PENDING の carryOver タスク（過去日でも翌日以降に表示し続ける）
-- ------------------------------------------------------------
SELECT
  q.id              AS quest_id,
  q.date            AS quest_date,
  q.status,
  COALESCE(q."snapshotTitle",    t.title)    AS title,
  COALESCE(q."snapshotEmoji",    t.emoji)    AS emoji,
  COALESCE(q."snapshotCategory", t.category) AS category,
  t.id              AS template_id,
  t."carryOver",
  t."isTemporary",
  t."photoBonus",
  q."photoUrl",
  q."deadlineBonusEarned",
  q."reportedAt",
  q."approvedAt"
FROM "QuestInstance" q
JOIN "TaskTemplate"  t ON t.id = q."templateId"
WHERE q."childId" = :child_id
  AND t."isActive" = TRUE
  AND (
        q.date = :today_jst::date
     OR (q.status = 'PENDING' AND t."carryOver" = TRUE)
      )
ORDER BY t."createdAt" ASC;


-- ------------------------------------------------------------
-- 2) 特定の子供の「今日 終わったタスク」一覧
--    src/app/api/quests/completed-today/route.ts と同じ条件
--      - status が APPROVED または SKIPPED
--      - reportedAt が JST 今日（00:00 〜 翌日 00:00 の UTC レンジ）
--    ※ JST 0:00 = 前日 15:00 UTC のため、UTC レンジで比較する
-- ------------------------------------------------------------
SELECT
  q.id              AS quest_id,
  q.date            AS quest_date,
  q.status,
  COALESCE(q."snapshotTitle",    t.title)    AS title,
  COALESCE(q."snapshotEmoji",    t.emoji)    AS emoji,
  COALESCE(q."snapshotCategory", t.category) AS category,
  q."reportedAt",
  q."approvedAt",
  q."photoUrl",
  q."deadlineBonusEarned"
FROM "QuestInstance" q
JOIN "TaskTemplate"  t ON t.id = q."templateId"
WHERE q."childId" = :child_id
  AND q.status IN ('APPROVED', 'SKIPPED')
  AND q."reportedAt" >= ((:today_jst::date - INTERVAL '9 hours'))               -- JST 0:00 = UTC 前日 15:00
  AND q."reportedAt" <  ((:today_jst::date - INTERVAL '9 hours') + INTERVAL '1 day')
ORDER BY q."reportedAt" DESC;


-- ------------------------------------------------------------
-- 3) 特定の子供の「終わったタスク」全期間履歴（任意の日付範囲）
--    監督・振り返り用。期間を絞りたい場合に使う
-- ------------------------------------------------------------
SELECT
  q.date            AS quest_date,
  q.status,
  COALESCE(q."snapshotTitle",    t.title)    AS title,
  COALESCE(q."snapshotCategory", t.category) AS category,
  q."approvedAt"
FROM "QuestInstance" q
JOIN "TaskTemplate"  t ON t.id = q."templateId"
WHERE q."childId" = :child_id
  AND q.status IN ('APPROVED', 'SKIPPED')
  AND q.date BETWEEN :from_jst::date AND :to_jst::date
ORDER BY q.date DESC, q."approvedAt" DESC;
