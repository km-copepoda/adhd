-- 宝箱の天井 (pity) システムを復活させ、User.treasurePityCount カラムを再導入。
-- 2026-06-02 に「ハズレ枠＝コレクション獲得で外れがなくなった」として撤廃したが、
-- 確率 1/10 でも 2 週間出ない不運パターンが実運用で発生し、子供のモチベを下げるため
-- 「10回に1回は必ず親ごほうび当選」を保証する救済として再導入する。
-- 関連: decisions.md 2026-06-24「宝箱の天井(pity)システムを復活」

ALTER TABLE "User" ADD COLUMN "treasurePityCount" INTEGER NOT NULL DEFAULT 0;
