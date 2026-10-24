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

// Codex指摘: 比較と更新を原子的にする（楽観的並行制御）
describe("並行承認での楽観ロック（#188 Codex）", () => {
  const p2025 = () => Object.assign(new Error("not found"), { code: "P2025" });

  it("日次: update の where に読み取った lastAchievedDate を含める", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(childUser({ minTasksForStreak: 1 }));
    mockPrisma.questInstance.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 5, bestStreak: 5, lastAchievedDate: d("2026-10-18") }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());
    await recordDailyAchievement("child-1", d("2026-10-19"));
    expect(mockPrisma.streak.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { childId: "child-1", lastAchievedDate: d("2026-10-18") },
      }),
    );
  });

  it("日次: 競合(P2025)したら再読込して古い日付なら巻き戻さない", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(childUser({ minTasksForStreak: 1 }));
    mockPrisma.questInstance.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    mockPrisma.streak.upsert
      .mockResolvedValueOnce(streak({ currentStreak: 5, bestStreak: 5, lastAchievedDate: d("2026-10-18") }))
      .mockResolvedValueOnce(streak({ currentStreak: 6, bestStreak: 6, lastAchievedDate: d("2026-10-20") }));
    mockPrisma.streak.update.mockRejectedValueOnce(p2025());
    await recordDailyAchievement("child-1", d("2026-10-19"));
    expect(mockPrisma.streak.update).toHaveBeenCalledTimes(1);
  });

  it("日次: P2025 以外のエラーは再スローする", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(childUser({ minTasksForStreak: 1 }));
    mockPrisma.questInstance.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ currentStreak: 5, bestStreak: 5, lastAchievedDate: d("2026-10-18") }),
    );
    mockPrisma.streak.update.mockRejectedValueOnce(new Error("boom"));
    await expect(recordDailyAchievement("child-1", d("2026-10-19"))).rejects.toThrow("boom");
  });

  it("タスク別: where に lastAchievedDate を含め、P2025 で再読込して巻き戻さない", async () => {
    mockPrisma.taskStreak.upsert
      .mockResolvedValueOnce(
        taskStreak({ id: "s1", taskId: "t1", childId: "c1", currentStreak: 5, bestStreak: 5, lastAchievedDate: d("2026-10-18") }),
      )
      .mockResolvedValueOnce(
        taskStreak({ id: "s1", taskId: "t1", childId: "c1", currentStreak: 6, bestStreak: 6, lastAchievedDate: d("2026-10-20") }),
      );
    mockPrisma.taskStreak.update.mockRejectedValueOnce(p2025());
    await recordTaskStreak("t1", "c1", d("2026-10-19"), [0, 1, 2, 3, 4, 5, 6]);
    expect(mockPrisma.taskStreak.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.taskStreak.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { taskId_childId: { taskId: "t1", childId: "c1" }, lastAchievedDate: d("2026-10-18") },
      }),
    );
  });
});
