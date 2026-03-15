-- Enable Supabase Realtime for QuestInstance and User tables
ALTER PUBLICATION supabase_realtime ADD TABLE "QuestInstance";
ALTER PUBLICATION supabase_realtime ADD TABLE "User";
