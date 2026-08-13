import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordDailyAchievement } from "@/lib/streak";
import { triggerMonsterEvolvedLog } from "@/lib/bulletinLog";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import { childUser, streak } from "../helpers/fixtures";

vi.mock("@/lib/bulletinLog", () => ({
  triggerMonsterEvolvedLog: vi.fn().mockResolvedValue(undefined),
  triggerBadgeLog: vi.fn().mockResolvedValue(undefined),
  triggerStreakTitleLog: vi.fn().mockResolvedValue(undefined),
}));

const mockTriggerMonsterEvolvedLog = vi.mocked(triggerMonsterEvolvedLog);

beforeEach(() => {
  vi.clearAllMocks();
});

// ヘルパー: count モックをセットアップ（achieved=APPROVED+SKIPPED, total の順）
function mockCounts(achieved: number, total: number) {
  mockPrisma.questInstance.count
    .mockResolvedValueOnce(achieved)
    .mockResolvedValueOnce(total);
}

describe("recordDailyAchievement", () => {
  const today = new Date("2026-03-13");

  it("必要数に達していなければ何もしない（minTasks=3, achieved=1）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ minTasksForStreak: 3 }),
    );
    mockCounts(1, 5);

    await recordDailyAchievement("child-1", today);

    expect(mockPrisma.streak.upsert).not.toHaveBeenCalled();
  });

  it("既に超過していれば何もしない（minTasks=1, achieved=2）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ minTasksForStreak: 1 }),
    );
    mockCounts(2, 3);

    await recordDailyAchievement("child-1", today);

    expect(mockPrisma.streak.upsert).not.toHaveBeenCalled();
  });

  it("初回達成でcurrentStreak=1にする（minTasks=1）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ minTasksForStreak: 1 }),
    );
    mockCounts(1, 3);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 0, bestStreak: 0, lastAchievedDate: null }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());

    await recordDailyAchievement("child-1", today);

    expect(mockPrisma.streak.update).toHaveBeenCalledWith({
      where: { childId: "child-1" },
      data: {
        currentStreak: 1,
        bestStreak: 1,
        lastAchievedDate: expect.any(Date),
      },
    });
  });

  it("昨日も達成済みなら連続日数を+1する", async () => {
    const yesterday = new Date("2026-03-12");
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ minTasksForStreak: 1 }),
    );
    mockCounts(1, 3);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 5, bestStreak: 10, lastAchievedDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());

    await recordDailyAchievement("child-1", today);

    expect(mockPrisma.streak.update).toHaveBeenCalledWith({
      where: { childId: "child-1" },
      data: {
        currentStreak: 6,
        bestStreak: 10,
        lastAchievedDate: expect.any(Date),
      },
    });
  });

  it("途切れた場合はcurrentStreak=1にリセットし、bestStreakは保持", async () => {
    const threeDaysAgo = new Date("2026-03-10");
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ minTasksForStreak: 1 }),
    );
    mockCounts(1, 3);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 5, bestStreak: 10, lastAchievedDate: threeDaysAgo }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());

    await recordDailyAchievement("child-1", today);

    expect(mockPrisma.streak.update).toHaveBeenCalledWith({
      where: { childId: "child-1" },
      data: {
        currentStreak: 1,
        bestStreak: 10,
        lastAchievedDate: expect.any(Date),
      },
    });
  });

  it("同日2回目の承認では変化なし（lastAchievedDate=今日）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ minTasksForStreak: 1 }),
    );
    mockCounts(1, 3);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 3, bestStreak: 5, lastAchievedDate: today }),
    );

    await recordDailyAchievement("child-1", today);

    expect(mockPrisma.streak.update).not.toHaveBeenCalled();
  });

  it("minTasks=3で3件目の達成（APPROVED+SKIPPED）でストリーク達成", async () => {
    const yesterday = new Date("2026-03-12");
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ minTasksForStreak: 3 }),
    );
    mockCounts(3, 5); // ちょうど3件 = 達成
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 2, bestStreak: 2, lastAchievedDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());

    await recordDailyAchievement("child-1", today);

    expect(mockPrisma.streak.update).toHaveBeenCalledWith({
      where: { childId: "child-1" },
      data: {
        currentStreak: 3,
        bestStreak: 3,
        lastAchievedDate: expect.any(Date),
      },
    });
  });

  it("タスク総数が最低数未満なら全完了で達成（total=2, min=3 → required=2）", async () => {
    const yesterday = new Date("2026-03-12");
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ minTasksForStreak: 3 }),
    );
    mockCounts(2, 2); // total=2 < min=3 → required=2, achieved=2 → 達成
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 1, bestStreak: 5, lastAchievedDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());

    await recordDailyAchievement("child-1", today);

    expect(mockPrisma.streak.update).toHaveBeenCalledWith({
      where: { childId: "child-1" },
      data: {
        currentStreak: 2,
        bestStreak: 5,
        lastAchievedDate: expect.any(Date),
      },
    });
  });

  it("3日連続達成でマイルストーンボーナスXPが付与される", async () => {
    const yesterday = new Date("2026-03-12");
    // 最初の findUnique は minTasksForStreak 取得用
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(childUser({ minTasksForStreak: 1 }))
      .mockResolvedValueOnce(childUser({ studyPt: 5, staminaPt: 3, lifePt: 2 }));
    mockCounts(1, 3);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 2, bestStreak: 2, lastAchievedDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());
    mockPrisma.user.update.mockResolvedValue(childUser());

    await recordDailyAchievement("child-1", today);

    expect(mockPrisma.user.update).toHaveBeenCalled();
  });

  it("rebirthPending中はマイルストーンボーナスでXPのみ加算し進化チェックをスキップ", async () => {
    const yesterday = new Date("2026-03-12");
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(childUser({ minTasksForStreak: 1 }))
      .mockResolvedValueOnce(childUser({
        studyPt: 15, staminaPt: 3, lifePt: 2,
        rebirthPending: true,
        evolutionStage: 3,
        evolutionPath: "STUDY_STAMINA_LIFE",
        collectedPaths: '["STUDY","STUDY_STAMINA","STUDY_STAMINA_LIFE"]',
      }));
    mockCounts(1, 3);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 2, bestStreak: 2, lastAchievedDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());
    mockPrisma.user.update.mockResolvedValue(childUser());

    await recordDailyAchievement("child-1", today);

    // XPのみ加算、進化関連フィールドは更新されないこと（= rebirthPendingチェックが先に行われ
    // isReborn/rebirthEggBonus を使う進化チェック分岐がスキップされたことの確認）
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studyPt: expect.any(Number),
          staminaPt: expect.any(Number),
          lifePt: expect.any(Number),
        }),
      }),
    );
    const updateData = mockPrisma.user.update.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty("evolutionStage");
    expect(updateData).not.toHaveProperty("evolutionPath");
  });

  it("マイルストーンボーナスで進化した場合、collectedPathsとmonsterLevelsが更新される", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // STUDY が選ばれる
    const yesterday = new Date("2026-03-12");
    // stage2、9pt蓄積中。ボーナス5ptで total=14 → 30未満なので進化しない
    // stage1、9pt蓄積中。ボーナス5ptで total=14 → 10以上なので進化する
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(childUser({ minTasksForStreak: 1 }))
      .mockResolvedValueOnce(childUser({
        studyPt: 4, staminaPt: 3, lifePt: 2,
        evolutionStage: 1,
        evolutionPath: "STUDY",
        collectedPaths: '["STUDY"]',
        monsterLevels: "{}",
      }));
    mockCounts(1, 3);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 2, bestStreak: 2, lastAchievedDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());
    mockPrisma.user.update.mockResolvedValue(childUser());

    await recordDailyAchievement("child-1", today);

    // collectedPaths に新パスが追加されること（isReborn 判定に使う collectedPaths が
    // 進化後に更新されていることの確認）
    const updateData = mockPrisma.user.update.mock.calls[0][0].data;
    expect(updateData).toHaveProperty("collectedPaths");
    expect(updateData).toHaveProperty("monsterLevels");
    expect(updateData.evolutionStage).toBe(2);

    vi.restoreAllMocks();
  });

  it("マイルストーンボーナスで進化した場合、triggerMonsterEvolvedLog が呼ばれる（掲示板書き込み）", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // STUDY が選ばれる
    const yesterday = new Date("2026-03-12");
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(childUser({ minTasksForStreak: 1 }))
      .mockResolvedValueOnce(childUser({
        studyPt: 4, staminaPt: 3, lifePt: 2,
        evolutionStage: 1,
        evolutionPath: "STUDY",
        collectedPaths: '["STUDY"]',
        monsterLevels: "{}",
      }));
    mockCounts(1, 3);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 2, bestStreak: 2, lastAchievedDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());
    mockPrisma.user.update.mockResolvedValue(childUser());

    await recordDailyAchievement("child-1", today);
    await new Promise((r) => setImmediate(r));

    expect(mockTriggerMonsterEvolvedLog).toHaveBeenCalledTimes(1);
    expect(mockTriggerMonsterEvolvedLog.mock.calls[0][0]).toBe("child-1");
    expect(typeof mockTriggerMonsterEvolvedLog.mock.calls[0][1]).toBe("string");

    vi.restoreAllMocks();
  });

  it("マイルストーンボーナスで進化しなかった場合、triggerMonsterEvolvedLog は呼ばれない", async () => {
    const yesterday = new Date("2026-03-12");
    mockPrisma.user.findUnique
      .mockResolvedValueOnce(childUser({ minTasksForStreak: 1 }))
      .mockResolvedValueOnce(childUser({
        studyPt: 0, staminaPt: 0, lifePt: 0,
        evolutionStage: 2,
        evolutionPath: "STUDY_STAMINA",
        collectedPaths: '["STUDY","STUDY_STAMINA"]',
      }));
    mockCounts(1, 3);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 2, bestStreak: 2, lastAchievedDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());
    mockPrisma.user.update.mockResolvedValue(childUser());

    await recordDailyAchievement("child-1", today);
    await new Promise((r) => setImmediate(r));

    expect(mockTriggerMonsterEvolvedLog).not.toHaveBeenCalled();
  });
});
