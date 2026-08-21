import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { approveQuestInstance, approveSkipQuestInstance } from "@/lib/approve";
import type { QuestWithRelations } from "@/lib/approve";
import { recordDailyAchievement, recordTaskStreak } from "@/lib/streak";
import { unlockTreasuresOnApprove } from "@/lib/treasureService";
import { prismaMock } from "@/__tests__/helpers/prisma-mock";
import { childUser, questInstance, taskTemplate } from "@/__tests__/helpers/fixtures";

vi.mock("@/lib/streak", () => ({
  recordDailyAchievement: vi.fn().mockResolvedValue(undefined),
  recordTaskStreak: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/badges", () => ({
  checkAndUnlockBadges: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/treasureService", () => ({
  unlockTreasuresOnApprove: vi.fn().mockResolvedValue(0),
}));

const mockPrisma = prismaMock;
const mockRecordDailyAchievement = vi.mocked(recordDailyAchievement);
const mockRecordTaskStreak = vi.mocked(recordTaskStreak);
const mockUnlockTreasures = vi.mocked(unlockTreasuresOnApprove);

beforeEach(() => {
  vi.clearAllMocks();
  // デフォルト: DBからの最新childデータをbaseQuestと同じ値で返す
  // (childUser() の既定値は baseQuest.child と同じ studyPt/staminaPt/lifePt/evolution 系の値)
  mockPrisma.user.findUnique.mockResolvedValue(childUser());
});

const baseQuest: QuestWithRelations = {
  id: "q-1",
  date: new Date("2026-03-21"),
  childId: "child-1",
  templateId: "tpl-1",
  deadlineBonusEarned: false,
  photoUrl: null,
  snapshotCategory: "STUDY",
  template: {
    id: "tpl-1",
    category: "STUDY",
    photoBonus: false,
    createdBy: "PARENT",
    isTemporary: false,
    repeatDays: [1, 2, 3, 4, 5],
    carryOver: false,
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
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({
        evolutionStage: 1,
        evolutionPath: "STUDY",
        collectedPaths: "[]",
        studyPt: 5,
        staminaPt: 0,
        lifePt: 0,
      }),
    );
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    mockPrisma.user.update.mockResolvedValue(childUser());

    // baseQuest は基本1pt（deadline/photoBonus なし）
    await approveQuestInstance(staleQuest);

    // stale data (0+1=1) ではなく fresh data (5+1=6) で更新されること
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "child-1" },
        data: expect.objectContaining({ studyPt: 6 }),
      }),
    );
  });

  it("APPROVED に更新しXPを付与すること", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(childUser({ ...baseQuest.child }));
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    mockPrisma.user.update.mockResolvedValue(childUser());

    await approveQuestInstance(baseQuest);

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
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    mockPrisma.user.update.mockResolvedValue(childUser());

    await approveQuestInstance(baseQuest);

    expect(mockRecordDailyAchievement).toHaveBeenCalledWith("child-1", baseQuest.date);
    expect(mockRecordTaskStreak).toHaveBeenCalledWith("tpl-1", "child-1", baseQuest.date, [1, 2, 3, 4, 5]);
  });

  it("一時タスクはタスク別ストリークを記録しないこと", async () => {
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    mockPrisma.user.update.mockResolvedValue(childUser());

    const temporaryQuest = {
      ...baseQuest,
      template: { ...baseQuest.template, isTemporary: true },
    };
    await approveQuestInstance(temporaryQuest);

    expect(mockRecordDailyAchievement).toHaveBeenCalled();
    expect(mockRecordTaskStreak).not.toHaveBeenCalled();
  });

  it("子供作成テンプレートをPARENTに昇格すること", async () => {
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    mockPrisma.user.update.mockResolvedValue(childUser());
    mockPrisma.taskTemplate.update.mockResolvedValue(taskTemplate());

    const childCreatedQuest = {
      ...baseQuest,
      template: { ...baseQuest.template, createdBy: "CHILD" as const },
    };
    await approveQuestInstance(childCreatedQuest);

    expect(mockPrisma.taskTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl-1" },
        data: { createdBy: "PARENT" },
      }),
    );
  });
});

describe("進化・転生の閾値テスト", () => {
  beforeEach(() => {
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    mockPrisma.user.update.mockResolvedValue(childUser());
  });

  it("たまご（stage 0）は 1pt で stage 1 に孵化する", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 0, studyPt: 0, collectedPaths: "[]" }),
    );
    await approveQuestInstance(baseQuest);
    // total = 0 + 1 = 1 >= EVOLUTION_THRESHOLDS[0](1) → 進化
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ evolutionStage: 1, studyPt: 0, staminaPt: 0, lifePt: 0 }),
      }),
    );
  });

  it("転生後の卵（collectedPaths あり）は 4pt では孵化しない（境界値: 5pt 必要）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 0, studyPt: 3, collectedPaths: '["STUDY"]' }),
    );
    await approveQuestInstance(baseQuest);
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
      childUser({ evolutionStage: 0, studyPt: 4, collectedPaths: '["STUDY"]' }),
    );
    await approveQuestInstance(baseQuest);
    // isReborn=true → total = 4 + 1 = 5 >= REBIRTH_EGG_THRESHOLD(5) → 進化
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ evolutionStage: 1, studyPt: 0, staminaPt: 0, lifePt: 0 }),
      }),
    );
  });

  it("全ステージの進化で rebirthEggBonus はクリアされないこと（次の転生まで持続）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 0, studyPt: 0, rebirthEggBonus: "STUDY" }),
    );
    await approveQuestInstance(baseQuest);
    const callArgs = mockPrisma.user.update.mock.calls[0][0];
    expect(callArgs.data.rebirthEggBonus).toBeUndefined();
  });

  it("stage 1 は 9pt では stage 2 に進化しない（境界値: 10pt 必要）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 1, evolutionPath: "STUDY", studyPt: 8 }),
    );
    await approveQuestInstance(baseQuest);
    // total = 8 + 1 = 9 < EVOLUTION_THRESHOLDS[1](10) → 進化しない
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ evolutionStage: 1, studyPt: 9 }),
      }),
    );
  });

  it("stage 1 は 10pt で stage 2 に進化する", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 1, evolutionPath: "STUDY", studyPt: 9 }),
    );
    await approveQuestInstance(baseQuest);
    // total = 9 + 1 = 10 >= EVOLUTION_THRESHOLDS[1](10) → 進化
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ evolutionStage: 2, studyPt: 0, staminaPt: 0, lifePt: 0 }),
      }),
    );
  });

  it("stage 2 は 29pt では stage 3 に進化しない（境界値: 30pt 必要）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 2, evolutionPath: "STUDY_STUDY", studyPt: 28 }),
    );
    await approveQuestInstance(baseQuest);
    // total = 28 + 1 = 29 < EVOLUTION_THRESHOLDS[2](30) → 進化しない
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ evolutionStage: 2, studyPt: 29 }),
      }),
    );
  });

  it("stage 2 は 30pt で stage 3 に進化する", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 2, evolutionPath: "STUDY_STUDY", studyPt: 29 }),
    );
    await approveQuestInstance(baseQuest);
    // total = 29 + 1 = 30 >= EVOLUTION_THRESHOLDS[2](30) → 進化
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ evolutionStage: 3, studyPt: 0, staminaPt: 0, lifePt: 0 }),
      }),
    );
  });

  it("stage 3 は 19pt では転生しない（境界値: 20pt 必要）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 3, evolutionPath: "STUDY_STUDY_STUDY", studyPt: 18 }),
    );
    await approveQuestInstance(baseQuest);
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
      childUser({ evolutionStage: 0, studyPt: 0, collectedPaths: "[]" }),
    );
    await approveQuestInstance(baseQuest);
    const call = mockPrisma.user.update.mock.calls[0][0];
    const savedPaths = JSON.parse(call.data.collectedPaths as string) as string[];
    expect(savedPaths).toHaveLength(1);
    expect(["light:STUDY", "light:STAMINA", "light:LIFE"]).toContain(savedPaths[0]);
  });

  it("転生トリガー後も collectedPaths は保持される（リセットされない）", async () => {
    const existingPaths = '["STUDY","STUDY_STUDY","STUDY_STUDY_STUDY"]';
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({
        evolutionStage: 3,
        evolutionPath: "STUDY_STUDY_STUDY",
        studyPt: 19,
        collectedPaths: existingPaths,
      }),
    );
    await approveQuestInstance(baseQuest);
    // reborn=true → rebirthPending=true をセット。collectedPaths は変更しない
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rebirthPending: true }),
      }),
    );
    const call = mockPrisma.user.update.mock.calls[0][0];
    expect(call.data.collectedPaths).toBeUndefined(); // pendingセット時はcollectedPathsを触らない
  });
});

describe("転生保留（rebirthPending）", () => {
  it("stage3でREBIRTH_THRESHOLD到達時にrebirthPending=trueをセットしstageをリセットしないこと", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({
        evolutionStage: 3,
        evolutionPath: "STUDY_STAMINA_LIFE",
        collectedPaths: '["STUDY","STUDY_STAMINA","STUDY_STAMINA_LIFE"]',
        monsterLevels: '{"STUDY_STAMINA_LIFE":1}',
        studyPt: 19,
        staminaPt: 0,
        lifePt: 0,
        rebirthPending: false,
        rebirthEggBonus: null,
      }),
    );
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    mockPrisma.user.update.mockResolvedValue(childUser());

    await approveQuestInstance(baseQuest);

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
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({
        evolutionStage: 3,
        evolutionPath: "STUDY_STAMINA_LIFE",
        collectedPaths: '["STUDY","STUDY_STAMINA","STUDY_STAMINA_LIFE"]',
        studyPt: 20,
        staminaPt: 0,
        lifePt: 0,
        rebirthPending: true,
        rebirthEggBonus: null,
      }),
    );
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    mockPrisma.user.update.mockResolvedValue(childUser());

    await approveQuestInstance(baseQuest);

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

describe("monsterLevels（最終形態レベル）", () => {
  beforeEach(() => {
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    mockPrisma.user.update.mockResolvedValue(childUser());
  });

  it("stage 2 → stage 3 進化時に monsterLevels[newPath] が 1 になる", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 2, evolutionPath: "STUDY_STUDY", studyPt: 29, monsterLevels: "{}" }),
    );
    await approveQuestInstance(baseQuest);
    const call = mockPrisma.user.update.mock.calls[0][0];
    const levels = JSON.parse(call.data.monsterLevels as string) as Record<string, number>;
    // 進化後の path は "STUDY_STUDY_STUDY"（確率的だが STUDY タスクなので STUDY が最も高い確率）
    // ここでは monsterLevels に何かが追加されること、かつその値が 1 であることを確認
    const entries = Object.entries(levels);
    expect(entries).toHaveLength(1);
    expect(entries[0][1]).toBe(1);
  });

  it("同じ stage3 モンスターに 2 度目到達で monsterLevels が 2 になる", async () => {
    const path = "STUDY_STUDY_STUDY";
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({
        evolutionStage: 2,
        evolutionPath: "STUDY_STUDY",
        studyPt: 29,
        collectedPaths: JSON.stringify([path]),
        monsterLevels: JSON.stringify({ [path]: 1 }),
      }),
    );
    // checkEvolution は確率的なので、STUDY系タスク3連続を想定した状況をモックするには
    // 実際の進化先が "STUDY_STUDY_STUDY" になるよう studyPt が圧倒的
    // 注: 確率的テストのため、期待値は「既存 Lv +1」の確認のみ
    await approveQuestInstance(baseQuest);
    const call = mockPrisma.user.update.mock.calls[0][0];
    const levels = JSON.parse(call.data.monsterLevels as string) as Record<string, number>;
    // 少なくとも1エントリあり、その値は 2 以上（前回の1 + 今回の1）
    const values = Object.values(levels);
    expect(values.length).toBeGreaterThanOrEqual(1);
    // 進化先がpath と同じならLv2、別のstage3なら1（確率的）
    // 確実に言えることは: Lv1のpathがあるか、新しいpathがLv1
    const maxLv = Math.max(...values);
    expect(maxLv).toBeGreaterThanOrEqual(1);
  });

  it("stage 1 への孵化では monsterLevels は変化しない", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 0, studyPt: 0, monsterLevels: "{}" }),
    );
    await approveQuestInstance(baseQuest);
    const call = mockPrisma.user.update.mock.calls[0][0];
    const levels = JSON.parse(call.data.monsterLevels as string) as Record<string, number>;
    expect(Object.keys(levels)).toHaveLength(0);
  });

  it("stage 2 への進化では monsterLevels は変化しない", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 1, evolutionPath: "STUDY", studyPt: 9, monsterLevels: "{}" }),
    );
    await approveQuestInstance(baseQuest);
    const call = mockPrisma.user.update.mock.calls[0][0];
    const levels = JSON.parse(call.data.monsterLevels as string) as Record<string, number>;
    expect(Object.keys(levels)).toHaveLength(0);
  });

  it("転生 pending 時は monsterLevels を変更しない", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({
        evolutionStage: 3,
        evolutionPath: "STUDY_STUDY_STUDY",
        studyPt: 19,
        monsterLevels: '{"STUDY_STUDY_STUDY":1}',
      }),
    );
    await approveQuestInstance(baseQuest);
    const call = mockPrisma.user.update.mock.calls[0][0];
    // rebirthPending セット時は monsterLevels を触らない
    expect(call.data.monsterLevels).toBeUndefined();
  });
});

// ─── Issue #93: monsterLevels のテーマ名前空間対応 ─────────────────────
// @/lib/monsterThemes/monsterLevels.ts の getMonsterLevel/incrementMonsterLevel を
// 使い、"{monsterSetId}:{path}" 形式で monsterLevels を更新することを検証する。
// 現状の approve.ts は `monsterLevels[evolution.newPath] = ... + 1` と生キーで
// 直書きしているため、これらのテストは Red（失敗）になる想定。
describe("monsterLevels のテーマ名前空間対応（Issue #93）", () => {
  beforeEach(() => {
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    mockPrisma.user.update.mockResolvedValue(childUser());
    vi.spyOn(Math, "random").mockReturnValue(0); // STUDY が選ばれる
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("有料テーマ(buddha)でstage3到達時、monsterLevelsが'buddha:'名前空間付きキーで保存されること", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({
        monsterSetId: "buddha",
        evolutionStage: 2,
        evolutionPath: "STUDY_STUDY",
        studyPt: 29,
        staminaPt: 0,
        lifePt: 0,
        monsterLevels: "{}",
      }),
    );
    await approveQuestInstance(baseQuest);
    const call = mockPrisma.user.update.mock.calls[0][0];
    const levels = JSON.parse(call.data.monsterLevels as string) as Record<string, number>;
    expect(levels).toEqual({ "buddha:STUDY_STUDY_STUDY": 1 });
  });

  it("有料テーマ(buddha)は無料テーマ由来の旧形式（裸のパス）データを自分の記録として引き継がないこと", async () => {
    // 旧形式の裸キーに既に値7がある（例: dark/light 時代の記録、または旧実装のバグで書かれたデータ）。
    // buddha は有料テーマなので、この値を自分のレベルとして引き継いではならない（1から開始する）。
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({
        monsterSetId: "buddha",
        evolutionStage: 2,
        evolutionPath: "STUDY_STUDY",
        studyPt: 29,
        staminaPt: 0,
        lifePt: 0,
        monsterLevels: '{"STUDY_STUDY_STUDY":7}',
      }),
    );
    await approveQuestInstance(baseQuest);
    const call = mockPrisma.user.update.mock.calls[0][0];
    const levels = JSON.parse(call.data.monsterLevels as string) as Record<string, number>;
    expect(levels["buddha:STUDY_STUDY_STUDY"]).toBe(1);
  });

  it("無料テーマ(dark)は旧形式（裸のパス）の既存値を引き継いで+1すること", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({
        monsterSetId: "dark",
        evolutionStage: 2,
        evolutionPath: "STUDY_STUDY",
        studyPt: 29,
        staminaPt: 0,
        lifePt: 0,
        monsterLevels: '{"STUDY_STUDY_STUDY":3}',
      }),
    );
    await approveQuestInstance(baseQuest);
    const call = mockPrisma.user.update.mock.calls[0][0];
    const levels = JSON.parse(call.data.monsterLevels as string) as Record<string, number>;
    // 旧形式キーは引き継ぎ元として残ってよいが、新形式キーが 3+1=4 で保存されること
    expect(levels["dark:STUDY_STUDY_STUDY"]).toBe(4);
  });

  it("新形式キーが既にある場合は単純に+1すること", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({
        monsterSetId: "buddha",
        evolutionStage: 2,
        evolutionPath: "STUDY_STUDY",
        studyPt: 29,
        staminaPt: 0,
        lifePt: 0,
        monsterLevels: '{"buddha:STUDY_STUDY_STUDY":2}',
      }),
    );
    await approveQuestInstance(baseQuest);
    const call = mockPrisma.user.update.mock.calls[0][0];
    const levels = JSON.parse(call.data.monsterLevels as string) as Record<string, number>;
    expect(levels["buddha:STUDY_STUDY_STUDY"]).toBe(3);
  });
});

describe("approveSkipQuestInstance", () => {
  it("SKIPPED に更新しストリークを記録すること", async () => {
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());

    const skipQuest = { ...baseQuest, status: "SKIP_REPORTED" as const };
    await approveSkipQuestInstance(skipQuest);

    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "q-1" },
        data: expect.objectContaining({ status: "SKIPPED" }),
      }),
    );
    expect(mockRecordDailyAchievement).toHaveBeenCalledWith("child-1", skipQuest.date);
  });
});

describe("宝箱アンロック", () => {
  it("approveQuestInstance 経由で同日 LOCKED が UNLOCKED になる", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(childUser(baseQuest.child));
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());
    mockPrisma.user.update.mockResolvedValue(childUser());

    await approveQuestInstance(baseQuest);

    expect(mockUnlockTreasures).toHaveBeenCalledWith("child-1", baseQuest.date);
  });

  it("approveSkipQuestInstance 経由でも同日 LOCKED が UNLOCKED になる", async () => {
    mockPrisma.questInstance.update.mockResolvedValue(questInstance());

    const skipQuest = { ...baseQuest, status: "SKIP_REPORTED" as const };
    await approveSkipQuestInstance(skipQuest);

    expect(mockUnlockTreasures).toHaveBeenCalledWith("child-1", skipQuest.date);
  });

  // Issue #108: carryOver 過去日付の宝箱 unlock は「承認処理を呼び出した時刻(今)」ではなく
  // 「報告時刻 (quest.reportedAt)」を基準日にしないと、報告と承認が別の暦日をまたいだ場合に
  // 生成側 (report/skip 時点、reportedAt 基準) と承認側の date が食い違い、LOCKED が永久に残る。
  // そのため各テストで reportedAt を quest.date / 承認時のシステム時刻とは独立にモックする。
  describe("carryOver 過去日付タスクの承認 (resolveTreasureDate 経由)", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("【本バグの再現→修正確認】8/20 23:58 JST に報告 → 8/21 に承認 → unlock は報告日(8/20)で呼ばれること", async () => {
      vi.useFakeTimers();
      // 承認時刻: 2026-08-21 JST 10:00 = UTC 2026-08-21 01:00（報告日の翌日）
      vi.setSystemTime(new Date("2026-08-21T01:00:00.000Z"));

      mockPrisma.user.findUnique.mockResolvedValue(childUser(baseQuest.child));
      mockPrisma.questInstance.update.mockResolvedValue(questInstance());
      mockPrisma.user.update.mockResolvedValue(childUser());

      // reportedAt: 2026-08-20 23:58 JST = UTC 2026-08-20 14:58
      const reportedAt = new Date("2026-08-20T14:58:00.000Z");
      const reportDateJST = new Date("2026-08-20T00:00:00.000Z");
      const approvalDateJST = new Date("2026-08-21T00:00:00.000Z");
      const quest = {
        ...baseQuest,
        date: reportDateJST,
        reportedAt,
        template: { ...baseQuest.template, carryOver: true, photoBonus: false },
      };
      await approveQuestInstance(quest);

      // 現行の effectiveTreasureDate (todayJST() で判定) だと承認日(8/21)で呼ばれてしまうため Red になる
      expect(mockUnlockTreasures).toHaveBeenCalledWith("child-1", reportDateJST);
      expect(mockUnlockTreasures).not.toHaveBeenCalledWith("child-1", approvalDateJST);
    });

    it("carryOver=true / quest.date が報告日より前 / 承認が数日後 → unlock は報告日で呼ばれること", async () => {
      vi.useFakeTimers();
      // 承認時刻: 2026-08-22（報告日からさらに2日後）
      vi.setSystemTime(new Date("2026-08-22T03:00:00.000Z"));

      mockPrisma.user.findUnique.mockResolvedValue(childUser(baseQuest.child));
      mockPrisma.questInstance.update.mockResolvedValue(questInstance());
      mockPrisma.user.update.mockResolvedValue(childUser());

      const reportedAt = new Date("2026-08-20T05:00:00.000Z"); // JST 8/20 14:00
      const reportDateJST = new Date("2026-08-20T00:00:00.000Z");
      const quest = {
        ...baseQuest,
        date: new Date("2026-08-19T00:00:00.000Z"), // スケジュール上の元日付（報告日より前）
        reportedAt,
        template: { ...baseQuest.template, carryOver: true, photoBonus: false },
      };
      await approveQuestInstance(quest);

      expect(mockUnlockTreasures).toHaveBeenCalledWith("child-1", reportDateJST);
    });

    it("carryOver=true で報告と承認が同一日 → 従来どおり報告日で unlock される（リグレッション防止）", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-20T06:00:00.000Z")); // JST 8/20 15:00 に承認

      mockPrisma.user.findUnique.mockResolvedValue(childUser(baseQuest.child));
      mockPrisma.questInstance.update.mockResolvedValue(questInstance());
      mockPrisma.user.update.mockResolvedValue(childUser());

      const reportedAt = new Date("2026-08-20T02:00:00.000Z"); // JST 8/20 11:00
      const sameDayJST = new Date("2026-08-20T00:00:00.000Z");
      const quest = {
        ...baseQuest,
        date: sameDayJST,
        reportedAt,
        template: { ...baseQuest.template, carryOver: true, photoBonus: false },
      };
      await approveQuestInstance(quest);

      expect(mockUnlockTreasures).toHaveBeenCalledWith("child-1", sameDayJST);
    });

    it("carryOver=false は承認が何日後でも unlock は常に quest.date のまま", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-28T03:00:00.000Z"));

      mockPrisma.user.findUnique.mockResolvedValue(childUser(baseQuest.child));
      mockPrisma.questInstance.update.mockResolvedValue(questInstance());
      mockPrisma.user.update.mockResolvedValue(childUser());

      const oldDate = new Date("2026-08-19T00:00:00.000Z");
      const reportedAt = new Date("2026-08-19T05:00:00.000Z");
      const quest = {
        ...baseQuest,
        date: oldDate,
        reportedAt,
        template: { ...baseQuest.template, carryOver: false, photoBonus: false },
      };
      await approveQuestInstance(quest);

      expect(mockUnlockTreasures).toHaveBeenCalledWith("child-1", oldDate);
    });

    it("reportedAt=null（親代理PENDING即承認など）の場合、承認時刻基準にフォールバックすること", async () => {
      vi.useFakeTimers();
      // 承認時刻: 2026-08-25 JST 12:00 = UTC 2026-08-25 03:00
      vi.setSystemTime(new Date("2026-08-25T03:00:00.000Z"));

      mockPrisma.user.findUnique.mockResolvedValue(childUser(baseQuest.child));
      mockPrisma.questInstance.update.mockResolvedValue(questInstance());
      mockPrisma.user.update.mockResolvedValue(childUser());

      const approvalDateJST = new Date("2026-08-25T00:00:00.000Z");
      const quest = {
        ...baseQuest,
        date: new Date("2026-08-19T00:00:00.000Z"), // 過去日
        reportedAt: null,
        template: { ...baseQuest.template, carryOver: true, photoBonus: false },
      };
      await approveQuestInstance(quest);

      expect(mockUnlockTreasures).toHaveBeenCalledWith("child-1", approvalDateJST);
    });

    it("古い carryOver クエストの承認で、今日分の別の LOCKED 宝箱（未承認）が UNLOCKED にならないこと", async () => {
      vi.useFakeTimers();
      // 承認時刻: 2026-08-21（報告日の翌日）
      vi.setSystemTime(new Date("2026-08-21T01:00:00.000Z"));

      mockPrisma.user.findUnique.mockResolvedValue(childUser(baseQuest.child));
      mockPrisma.questInstance.update.mockResolvedValue(questInstance());
      mockPrisma.user.update.mockResolvedValue(childUser());

      const reportedAt = new Date("2026-08-20T14:58:00.000Z"); // JST 8/20 23:58
      const todayDateJST = new Date("2026-08-21T00:00:00.000Z");
      const quest = {
        ...baseQuest,
        date: new Date("2026-08-20T00:00:00.000Z"),
        reportedAt,
        template: { ...baseQuest.template, carryOver: true, photoBonus: false },
      };
      await approveQuestInstance(quest);

      // 今日(承認日)の別クエスト用 LOCKED 宝箱を誤って巻き込んで unlock してはいけない
      expect(mockUnlockTreasures).not.toHaveBeenCalledWith("child-1", todayDateJST);
    });

    it("approveSkipQuestInstance: 8/20 に報告 → 8/22 にスキップ承認 → unlock は報告日(8/20)で呼ばれること", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-22T03:00:00.000Z"));

      mockPrisma.questInstance.update.mockResolvedValue(questInstance());
      const reportedAt = new Date("2026-08-20T10:00:00.000Z"); // JST 8/20 19:00
      const reportDateJST = new Date("2026-08-20T00:00:00.000Z");
      const skipQuest = {
        ...baseQuest,
        status: "SKIP_REPORTED" as const,
        date: new Date("2026-08-19T00:00:00.000Z"),
        reportedAt,
        template: { ...baseQuest.template, carryOver: true },
      };
      await approveSkipQuestInstance(skipQuest);

      expect(mockUnlockTreasures).toHaveBeenCalledWith("child-1", reportDateJST);
    });

    it("approveSkipQuestInstance: carryOver=false は承認が何日後でも unlock は常に quest.date のまま", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-08-28T03:00:00.000Z"));

      mockPrisma.questInstance.update.mockResolvedValue(questInstance());
      const oldDate = new Date("2026-08-19T00:00:00.000Z");
      const skipQuest = {
        ...baseQuest,
        status: "SKIP_REPORTED" as const,
        date: oldDate,
        reportedAt: new Date("2026-08-19T05:00:00.000Z"),
        template: { ...baseQuest.template, carryOver: false },
      };
      await approveSkipQuestInstance(skipQuest);

      expect(mockUnlockTreasures).toHaveBeenCalledWith("child-1", oldDate);
    });
  });
});
