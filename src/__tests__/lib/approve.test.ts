import { describe, it, expect, vi, beforeEach } from "vitest";
import { approveQuestInstance, approveSkipQuestInstance } from "@/lib/approve";
import { prisma } from "@/lib/prisma";
import { recordDailyAchievement, recordTaskStreak } from "@/lib/streak";

vi.mock("@/lib/streak", () => ({
  recordDailyAchievement: vi.fn().mockResolvedValue(undefined),
  recordTaskStreak: vi.fn().mockResolvedValue(undefined),
}));

const mockPrisma = vi.mocked(prisma);
const mockRecordDailyAchievement = vi.mocked(recordDailyAchievement);
const mockRecordTaskStreak = vi.mocked(recordTaskStreak);

beforeEach(() => {
  vi.clearAllMocks();
});

const baseQuest = {
  id: "q-1",
  date: new Date("2026-03-21"),
  childId: "child-1",
  templateId: "tpl-1",
  status: "REPORTED" as const,
  template: {
    id: "tpl-1",
    difficulty: "NORMAL" as const,
    category: "STUDY" as const,
    createdBy: "PARENT" as const,
    isTemporary: false,
  },
  child: {
    id: "child-1",
    evolutionStage: 0,
    evolutionPath: "",
    collectedPaths: "[]",
    studyPt: 0,
    staminaPt: 0,
    lifePt: 0,
  },
};

describe("approveQuestInstance", () => {
  it("APPROVED に更新しXPを付与すること", async () => {
    mockPrisma.questInstance.update.mockResolvedValue({} as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    await approveQuestInstance(baseQuest as any);

    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "q-1" },
        data: expect.objectContaining({ status: "APPROVED" }),
      }),
    );
    // user.update が呼ばれること（XP付与・進化処理が実行されること）
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "child-1" },
        data: expect.objectContaining({
          evolutionStage: expect.any(Number),
          evolutionPath: expect.any(String),
          studyPt: expect.any(Number),
        }),
      }),
    );
  });

  it("ストリークを記録すること", async () => {
    mockPrisma.questInstance.update.mockResolvedValue({} as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    await approveQuestInstance(baseQuest as any);

    expect(mockRecordDailyAchievement).toHaveBeenCalledWith("child-1", baseQuest.date);
    expect(mockRecordTaskStreak).toHaveBeenCalledWith("tpl-1", "child-1", baseQuest.date);
  });

  it("一時タスクはタスク別ストリークを記録しないこと", async () => {
    mockPrisma.questInstance.update.mockResolvedValue({} as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    const temporaryQuest = {
      ...baseQuest,
      template: { ...baseQuest.template, isTemporary: true },
    };
    await approveQuestInstance(temporaryQuest as any);

    expect(mockRecordDailyAchievement).toHaveBeenCalled();
    expect(mockRecordTaskStreak).not.toHaveBeenCalled();
  });

  it("子供作成テンプレートをPARENTに昇格すること", async () => {
    mockPrisma.questInstance.update.mockResolvedValue({} as any);
    mockPrisma.user.update.mockResolvedValue({} as any);
    mockPrisma.taskTemplate.update.mockResolvedValue({} as any);

    const childCreatedQuest = {
      ...baseQuest,
      template: { ...baseQuest.template, createdBy: "CHILD" as const },
    };
    await approveQuestInstance(childCreatedQuest as any);

    expect(mockPrisma.taskTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl-1" },
        data: { createdBy: "PARENT" },
      }),
    );
  });
});

describe("approveSkipQuestInstance", () => {
  it("SKIPPED に更新しストリークを記録すること", async () => {
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const skipQuest = { ...baseQuest, status: "SKIP_REPORTED" as const };
    await approveSkipQuestInstance(skipQuest as any);

    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "q-1" },
        data: expect.objectContaining({ status: "SKIPPED" }),
      }),
    );
    expect(mockRecordDailyAchievement).toHaveBeenCalledWith("child-1", skipQuest.date);
  });
});
