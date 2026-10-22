import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordDailyAchievement, recordTaskStreak } from "@/lib/streak";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import { childUser, streak, taskStreak } from "../helpers/fixtures";

vi.mock("@/lib/bulletinLog", () => ({
  triggerMonsterEvolvedLog: vi.fn().mockResolvedValue(undefined),
  triggerBadgeLog: vi.fn().mockResolvedValue(undefined),
  triggerStreakTitleLog: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const d = (s: string) => new Date(s + "T00:00:00Z");

// Issue #188: 既に新しい日付が記録済みのとき、古い日付の後追い承認でストリークを巻き戻さない
describe("recordDailyAchievement: 古い日付の後追い承認（#188）", () => {
  function setup(last: string, current: number, best: number) {
    mockPrisma.user.findUnique.mockResolvedValue(childUser({ minTasksForStreak: 1 }));
    mockPrisma.questInstance.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: current, bestStreak: best, lastAchievedDate: d(last) }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());
  }

  it("lastDate が questDate より新しい（+1日）なら更新しない", async () => {
    setup("2026-10-20", 5, 5);
    await recordDailyAchievement("child-1", d("2026-10-19"));
    expect(mockPrisma.streak.update).not.toHaveBeenCalled();
  });

  it("lastDate が questDate より大きく新しくても更新しない", async () => {
    setup("2026-10-25", 8, 8);
    await recordDailyAchievement("child-1", d("2026-10-19"));
    expect(mockPrisma.streak.update).not.toHaveBeenCalled();
  });

  it("lastDate === questDate は従来どおり同日処理済みで更新しない", async () => {
    setup("2026-10-19", 5, 5);
    await recordDailyAchievement("child-1", d("2026-10-19"));
    expect(mockPrisma.streak.update).not.toHaveBeenCalled();
  });

  it("昇順 10/19 → 10/20 なら 5 → 6 → 7 と加算される", async () => {
    setup("2026-10-18", 5, 5);
    await recordDailyAchievement("child-1", d("2026-10-19"));
    expect(mockPrisma.streak.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentStreak: 6 }) }),
    );

    setup("2026-10-19", 6, 6);
    await recordDailyAchievement("child-1", d("2026-10-20"));
    expect(mockPrisma.streak.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentStreak: 7 }) }),
    );
  });

  it("月跨ぎ: last=11/01 のとき 10/31 は更新しない", async () => {
    setup("2026-11-01", 3, 3);
    await recordDailyAchievement("child-1", d("2026-10-31"));
    expect(mockPrisma.streak.update).not.toHaveBeenCalled();
  });

  it("年跨ぎ: last=2027-01-01 のとき 2026-12-31 は更新しない", async () => {
    setup("2027-01-01", 3, 3);
    await recordDailyAchievement("child-1", d("2026-12-31"));
    expect(mockPrisma.streak.update).not.toHaveBeenCalled();
  });

  it("年跨ぎ: last=2026-12-31 のとき 2027-01-01 は +1 される", async () => {
    setup("2026-12-31", 3, 3);
    await recordDailyAchievement("child-1", d("2027-01-01"));
    expect(mockPrisma.streak.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentStreak: 4 }) }),
    );
  });
});

describe("recordTaskStreak: 古い日付の後追い承認（#188）", () => {
  const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
  function setup(last: string, current: number) {
    mockPrisma.taskStreak.upsert.mockResolvedValue(
      taskStreak({
        id: "s1",
        taskId: "t1",
        childId: "c1",
        currentStreak: current,
        bestStreak: current,
        lastAchievedDate: d(last),
      }),
    );
  }

  it("lastDate が questDate より新しい（+1日）なら更新しない", async () => {
    setup("2026-10-20", 5);
    await recordTaskStreak("t1", "c1", d("2026-10-19"), EVERY_DAY);
    expect(mockPrisma.taskStreak.update).not.toHaveBeenCalled();
  });

  it("lastDate === questDate は従来どおり更新しない", async () => {
    setup("2026-10-19", 5);
    await recordTaskStreak("t1", "c1", d("2026-10-19"), EVERY_DAY);
    expect(mockPrisma.taskStreak.update).not.toHaveBeenCalled();
  });

  it("月跨ぎ: last=11/02 のとき 10/31 は更新しない", async () => {
    setup("2026-11-02", 5);
    await recordTaskStreak("t1", "c1", d("2026-10-31"), EVERY_DAY);
    expect(mockPrisma.taskStreak.update).not.toHaveBeenCalled();
  });

  it("年跨ぎ: last=2027-01-01 のとき 2026-12-31 は更新しない", async () => {
    setup("2027-01-01", 5);
    await recordTaskStreak("t1", "c1", d("2026-12-31"), EVERY_DAY);
    expect(mockPrisma.taskStreak.update).not.toHaveBeenCalled();
  });

  it("年跨ぎ: last=2026-12-31 のとき 2027-01-01 は +1 される", async () => {
    setup("2026-12-31", 5);
    await recordTaskStreak("t1", "c1", d("2027-01-01"), EVERY_DAY);
    expect(mockPrisma.taskStreak.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentStreak: 6 }) }),
    );
  });
});
