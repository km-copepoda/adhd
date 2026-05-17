-- 今日やる宣言ボーナス: 子供が当日内に「今日やる」を押した事実を記録するテーブル。
-- 同 (template, child, date) で重複は1件まで（unique）。
-- 親テンプレ削除・子削除に追従して cascade。

CREATE TABLE "QuestDeclaration" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestDeclaration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuestDeclaration_templateId_childId_date_key" ON "QuestDeclaration"("templateId", "childId", "date");
CREATE INDEX "QuestDeclaration_childId_date_idx" ON "QuestDeclaration"("childId", "date");

ALTER TABLE "QuestDeclaration" ADD CONSTRAINT "QuestDeclaration_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TaskTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestDeclaration" ADD CONSTRAINT "QuestDeclaration_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
