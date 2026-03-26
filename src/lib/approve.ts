import { prisma } from "@/lib/prisma";
import { XP_MAP, checkEvolution } from "@/lib/constants";
import { recordDailyAchievement, recordTaskStreak } from "@/lib/streak";
type QuestWithRelations = {
  id: string;
  date: Date;
  childId: string;
  templateId: string;
  template: {
    id: string;
    difficulty: "EASY" | "NORMAL" | "HARD";
    category: "STUDY" | "STAMINA" | "LIFE";
    createdBy: "PARENT" | "CHILD";
    isTemporary: boolean;
  };
  child: {
    id: string;
    evolutionStage: number;
    evolutionPath: string;
    collectedPaths: string;
    studyPt: number;
    staminaPt: number;
    lifePt: number;
  };
};

export async function approveQuestInstance(quest: QuestWithRelations): Promise<void> {
  const xp = XP_MAP[quest.template.difficulty];
  const category = quest.template.category;
  const child = quest.child;

  const newStudy = child.studyPt + (category === "STUDY" ? xp : 0);
  const newStamina = child.staminaPt + (category === "STAMINA" ? xp : 0);
  const newLife = child.lifePt + (category === "LIFE" ? xp : 0);

  const evolution = checkEvolution(
    child.evolutionStage,
    child.evolutionPath,
    newStudy,
    newStamina,
    newLife,
  );

  await prisma.questInstance.update({
    where: { id: quest.id },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  // collectedPaths: 進化時に新パスを追加、転生時はそのまま保持
  let collectedPaths = JSON.parse(child.collectedPaths) as string[];
  if (evolution.evolved) {
    if (!collectedPaths.includes(evolution.newPath)) {
      collectedPaths = [...collectedPaths, evolution.newPath];
    }
  }

  await prisma.user.update({
    where: { id: quest.childId },
    data: {
      studyPt: evolution.resetStudy,
      staminaPt: evolution.resetStamina,
      lifePt: evolution.resetLife,
      evolutionStage: evolution.newStage,
      evolutionPath: evolution.newPath,
      collectedPaths: JSON.stringify(collectedPaths),
    },
  });

  if (quest.template.createdBy === "CHILD") {
    await prisma.taskTemplate.update({
      where: { id: quest.templateId },
      data: { createdBy: "PARENT" },
    });
  }

  await recordDailyAchievement(quest.childId, quest.date);
  if (!quest.template.isTemporary) {
    await recordTaskStreak(quest.templateId, quest.childId, quest.date);
  }
}

export async function approveSkipQuestInstance(quest: Pick<QuestWithRelations, "id" | "childId" | "date">): Promise<void> {
  await prisma.questInstance.update({
    where: { id: quest.id },
    data: { status: "SKIPPED", approvedAt: new Date() },
  });
  await recordDailyAchievement(quest.childId, quest.date);
}
