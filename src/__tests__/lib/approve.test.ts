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
  // デフォルト: DBからの最新childデータをbaseQuestと同じ値で返す
  mockPrisma.user.findUnique.mockResolvedValue(baseQuest.child as any);
});

const baseQuest = {
  id: "q-1",
  date: new Date("2026-03-21"),
  childId: "child-1",
  templateId: "tpl-1",
  status: "REPORTED" as const,
  template: {
    id: "tpl-1",
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
  it("quest.child が古いデータでも最新のDBデータを使用してポイントを計算すること", async () => {
    // 古い（stale）quest.child データ: studyPt = 0
    const staleQuest = {
      ...baseQuest,
      child: { ...baseQuest.child, studyPt: 0 },
    };
    // DB上の最新データ: studyPt = 5（別クエスト承認済み）
    // evolutionStage = 1 にして進化閾値10ptを超えないようにする（5+3=8 < 10 → 進化なし）
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "child-1",
      evolutionStage: 1,
      evolutionPath: "STUDY",
      collectedPaths: "[]",
      studyPt: 5,
      staminaPt: 0,
      lifePt: 0,
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    // baseQuest は基本1pt（deadline/photoBonus なし）
    await approveQuestInstance(staleQuest as any);

    // stale data (0+1=1) ではなく fresh data (5+1=6) で更新されること
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "child-1" },
        data: expect.objectContaining({ studyPt: 6 }),
      }),
    );
  });

  it("APPROVED に更新しXPを付与すること", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseQuest.child,
    } as any);
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

describe("転生保留（rebirthPending）", () => {
  it("stage3でREBIRTH_THRESHOLD到達時にrebirthPending=trueをセットしstageをリセットしないこと", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "child-1",
      evolutionStage: 3,
      evolutionPath: "STUDY_STAMINA_LIFE",
      collectedPaths: '["STUDY","STUDY_STAMINA","STUDY_STAMINA_LIFE"]',
      studyPt: 19,
      staminaPt: 0,
      lifePt: 0,
      rebirthPending: false,
      rebirthEggBonus: null,
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    await approveQuestInstance(baseQuest as any);

    // user.update は rebirthPending=true をセットすること
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rebirthPending: true,
        }),
      }),
    );
    // evolutionStage はリセットされないこと（3のまま）
    const callArgs = mockPrisma.user.update.mock.calls[0][0];
    expect(callArgs.data.evolutionStage).toBeUndefined();
  });

  it("rebirthPending=true のときXPを加算するがevolution/rebirthを実行しないこと", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "child-1",
      evolutionStage: 3,
      evolutionPath: "STUDY_STAMINA_LIFE",
      collectedPaths: '["STUDY","STUDY_STAMINA","STUDY_STAMINA_LIFE"]',
      studyPt: 20,
      staminaPt: 0,
      lifePt: 0,
      rebirthPending: true,
      rebirthEggBonus: null,
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    await approveQuestInstance(baseQuest as any);

    // studyPt は +1 されること (20+1=21)
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studyPt: 21,
        }),
      }),
    );
    // evolutionStage はリセットされないこと
    const callArgs = mockPrisma.user.update.mock.calls[0][0];
    expect(callArgs.data.evolutionStage).toBeUndefined();
    // rebirthPending は変更されないこと（true のまま）
    expect(callArgs.data.rebirthPending).toBeUndefined();
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
