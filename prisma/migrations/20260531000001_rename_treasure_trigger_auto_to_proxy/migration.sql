-- AUTO は当初 auto-approve cron と親代理経路で trigger を共有する意図で命名したが、
-- 2026-05-31 で cron 側の AUTO 生成を撤回したため、親代理 report-approve 専用と
-- なった。実態に合わせて PROXY にリネームする。
-- 設計変更: 2026-05-31 (decisions.md 参照)

ALTER TYPE "TreasureTrigger" RENAME VALUE 'AUTO' TO 'PROXY';
