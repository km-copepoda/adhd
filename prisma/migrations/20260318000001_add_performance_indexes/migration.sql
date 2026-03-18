-- QuestInstance: childId, (childId, date), (childId, status) indexes
CREATE INDEX IF NOT EXISTS "QuestInstance_childId_idx" ON "QuestInstance"("childId");
CREATE INDEX IF NOT EXISTS "QuestInstance_childId_date_idx" ON "QuestInstance"("childId", "date");
CREATE INDEX IF NOT EXISTS "QuestInstance_childId_status_idx" ON "QuestInstance"("childId", "status");

-- TaskTemplate: familyId, assignedChildId indexes
CREATE INDEX IF NOT EXISTS "TaskTemplate_familyId_idx" ON "TaskTemplate"("familyId");
CREATE INDEX IF NOT EXISTS "TaskTemplate_assignedChildId_idx" ON "TaskTemplate"("assignedChildId");

-- User: familyId index
CREATE INDEX IF NOT EXISTS "User_familyId_idx" ON "User"("familyId");
