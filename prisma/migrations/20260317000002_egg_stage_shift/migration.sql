-- Shift existing users' evolutionStage up by 1 to make room for egg at stage 0
UPDATE "User" SET "evolutionStage" = "evolutionStage" + 1;
