import { describe, it, expect, vi, beforeEach } from "vitest";
import { approveQuestInstance, approveSkipQuestInstance } from "@/lib/approve";
import { prisma } from "@/lib/prisma";
import { recordDailyAchievement, recordTaskStreak } from "@/lib/streak";

vi.mock("@/lib/streak", () => ({
  recordDailyAchievement: vi.fn().mockResolvedValue(undefined),
  recordTaskStreak: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/badges", () => ({
  checkAndUnlockBadges: vi.fn().mockResolvedValue([]),
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

describe("進化・転生の閾値テスト", () => {
  const makeChild = (overrides: Partial<typeof baseQuest.child & { rebirthPending: boolean; rebirthEggBonus: string | null }>) => ({
    ...baseQuest.child,
    rebirthPending: false,
    rebirthEggBonus: null,
    ...overrides,
  });

  beforeEach(() => {
    mockPrisma.questInstance.update.mockResolvedValue({} as any);
    mockPrisma.user.update.mockResolvedValue({} as any);
  });

  it("たまご（stage 0）は 1pt で stage 1 に孵化する", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      makeChild({ evolutionStage: 0, studyPt: 0, collectedPaths: "[]" }) as any,
    );
    await approveQuestInstance(baseQuest as any);
    // total = 0 + 1 = 1 >= EVOLUTION_THRESHOLDS[0](1) → 進化
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ evolutionStage: 1, studyPt: 0, staminaPt: 0, lifePt: 0 }),
      }),
    );
  });

  it("転生後の卵（collectedPaths あり）は 4pt では孵化しない（境界値: 5pt 必要）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      makeChild({ evolutionStage: 0, studyPt: 3, collectedPaths: '["STUDY"]' }) as any,
    );
    await approveQuestInstance(baseQuest as any);
    // isReborn=true → REBIRTH_EGG_THRESHOLD=5 が適用される
    // total = 3 + 1 = 4 < 5 → 孵化しない
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ evolutionStage: 0, studyPt: 4 }),
      }),
    );
  });

  it("転生後の卵は 5pt で stage 1 に孵化する（REBIRTH_EGG_THRESHOLD）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      makeChild({ evolutionStage: 0, studyPt: 4, collectedPaths: '["STUDY"]' }) as any,
    );
    await approveQuestInstance(baseQuest as any);
    // isReborn=true → total = 4 + 1 = 5 >= REBIRTH_EGG_THRESHOLD(5) → 進化
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ evolutionStage: 1, studyPt: 0, staminaPt: 0, lifePt: 0 }),
      }),
    );
  });

  it("stage 1 は 9pt では stage 2 に進化しない（境界値: 10pt 必要）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      makeChild({ evolutionStage: 1, evolutionPath: "STUDY", studyPt: 8 }) as any,
    );
    await approveQuestInstance(baseQuest as any);
    // total = 8 + 1 = 9 < EVOLUTION_THRESHOLDS[1](10) → 進化しない
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ evolutionStage: 1, studyPt: 9 }),
      }),
    );
  });

  it("stage 1 は 10pt で stage 2 に進化する", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      makeChild({ evolutionStage: 1, evolutionPath: "STUDY", studyPt: 9 }) as any,
    );
    await approveQuestInstance(baseQuest as any);
    // total = 9 + 1 = 10 >= EVOLUTION_THRESHOLDS[1](10) → 進化
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ evolutionStage: 2, studyPt: 0, staminaPt: 0, lifePt: 0 }),
      }),
    );
  });

  it("stage 2 は 29pt では stage 3 に進化しない（境界値: 30pt 必要）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      makeChild({ evolutionStage: 2, evolutionPath: "STUDY_STUDY", studyPt: 28 }) as any,
    );
    await approveQuestInstance(baseQuest as any);
    // total = 28 + 1 = 29 < EVOLUTION_THRESHOLDS[2](30) → 進化しない
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ evolutionStage: 2, studyPt: 29 }),
      }),
    );
  });

  it("stage 2 は 30pt で stage 3 に進化する", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      makeChild({ evolutionStage: 2, evolutionPath: "STUDY_STUDY", studyPt: 29 }) as any,
    );
    await approveQuestInstance(baseQuest as any);
    // total = 29 + 1 = 30 >= EVOLUTION_THRESHOLDS[2](30) → 進化
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ evolutionStage: 3, studyPt: 0, staminaPt: 0, lifePt: 0 }),
      }),
    );
  });

  it("stage 3 は 19pt では転生しない（境界値: 20pt 必要）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      makeChild({ evolutionStage: 3, evolutionPath: "STUDY_STUDY_STUDY", studyPt: 18 }) as any,
    );
    await approveQuestInstance(baseQuest as any);
    // total = 18 + 1 = 19 < REBIRTH_THRESHOLD(20) → 転生しない
    // reborn=false → 通常XP加算パスで更新される
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ evolutionStage: 3, studyPt: 19 }),
      }),
    );
  });

  it("進化時に collectedPaths に新しいパスが追加される", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      makeChild({ evolutionStage: 0, studyPt: 0, collectedPaths: "[]" }) as any,
    );
    await approveQuestInstance(baseQuest as any);
    const call = mockPrisma.user.update.mock.calls[0][0] as any;
    const savedPaths = JSON.parse(call.data.collectedPaths as string) as string[];
    expect(savedPaths).toHaveLength(1);
    expect(["STUDY", "STAMINA", "LIFE"]).toContain(savedPaths[0]);
  });

  it("転生トリガー後も collectedPaths は保持される（リセットされない）", async () => {
    const existingPaths = '["STUDY","STUDY_STUDY","STUDY_STUDY_STUDY"]';
    mockPrisma.user.findUnique.mockResolvedValue(
      makeChild({
        evolutionStage: 3,
        evolutionPath: "STUDY_STUDY_STUDY",
        studyPt: 19,
        collectedPaths: existingPaths,
      }) as any,
    );
    await approveQuestInstance(baseQuest as any);
    // reborn=true → rebirthPending=true をセット。collectedPaths は変更しない
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rebirthPending: true }),
      }),
    );
    const call = mockPrisma.user.update.mock.calls[0][0] as any;
    expect(call.data.collectedPaths).toBeUndefined(); // pendingセット時はcollectedPathsを触らない
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
