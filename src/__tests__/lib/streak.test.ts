import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordDailyAchievement } from "@/lib/streak";
import { childUser, streak } from "../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);

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
      childUser({ minTasksForStreak: 3 }) as any,
    );
    mockCounts(1, 5);

    await recordDailyAchievement("child-1", today);

    expect(mockPrisma.streak.upsert).not.toHaveBeenCalled();
  });

  it("既に超過していれば何もしない（minTasks=1, achieved=2）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ minTasksForStreak: 1 }) as any,
    );
    mockCounts(2, 3);

    await recordDailyAchievement("child-1", today);

    expect(mockPrisma.streak.upsert).not.toHaveBeenCalled();
  });

  it("初回達成でcurrentStreak=1にする（minTasks=1）", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ minTasksForStreak: 1 }) as any,
    );
    mockCounts(1, 3);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 0, bestStreak: 0, lastAchievedDate: null }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);

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
      childUser({ minTasksForStreak: 1 }) as any,
    );
    mockCounts(1, 3);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 5, bestStreak: 10, lastAchievedDate: yesterday }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);

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
      childUser({ minTasksForStreak: 1 }) as any,
    );
    mockCounts(1, 3);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 5, bestStreak: 10, lastAchievedDate: threeDaysAgo }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);

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
      childUser({ minTasksForStreak: 1 }) as any,
    );
    mockCounts(1, 3);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 3, bestStreak: 5, lastAchievedDate: today }) as any,
    );

    await recordDailyAchievement("child-1", today);

    expect(mockPrisma.streak.update).not.toHaveBeenCalled();
  });

  it("minTasks=3で3件目の達成（APPROVED+SKIPPED）でストリーク達成", async () => {
    const yesterday = new Date("2026-03-12");
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ minTasksForStreak: 3 }) as any,
    );
    mockCounts(3, 5); // ちょうど3件 = 達成
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 2, bestStreak: 2, lastAchievedDate: yesterday }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);

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
      childUser({ minTasksForStreak: 3 }) as any,
    );
    mockCounts(2, 2); // total=2 < min=3 → required=2, achieved=2 → 達成
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 1, bestStreak: 5, lastAchievedDate: yesterday }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);

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
      .mockResolvedValueOnce(childUser({ minTasksForStreak: 1 }) as any)
      .mockResolvedValueOnce(childUser({ studyPt: 5, staminaPt: 3, lifePt: 2 }) as any);
    mockCounts(1, 3);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 2, bestStreak: 2, lastAchievedDate: yesterday }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    await recordDailyAchievement("child-1", today);

    expect(mockPrisma.user.update).toHaveBeenCalled();
  });
});
