import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordTaskStreak } from "@/lib/streak";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import { taskStreak } from "../helpers/fixtures";

beforeEach(() => {
  vi.clearAllMocks();
});

function dateUTC(s: string): Date {
  return new Date(s + "T00:00:00Z");
}

describe("recordTaskStreak (repeatDays aware)", () => {
  // 2026-04-27 = Mon, 2026-04-29 = Wed, 2026-05-01 = Fri, 2026-05-04 = Mon

  it("初回達成: currentStreak=1 で記録", async () => {
    mockPrisma.taskStreak.upsert.mockResolvedValue(
      taskStreak({
        id: "s1",
        taskId: "t1",
        childId: "c1",
        currentStreak: 0,
        bestStreak: 0,
        lastAchievedDate: null,
      }),
    );

    await recordTaskStreak("t1", "c1", dateUTC("2026-04-29"), [1, 3, 5]);

    expect(mockPrisma.taskStreak.update).toHaveBeenCalledWith({
      where: { taskId_childId: { taskId: "t1", childId: "c1" } },
      data: {
        currentStreak: 1,
        bestStreak: 1,
        lastAchievedDate: expect.any(Date),
      },
    });
  });

  it("月水金: 月曜→水曜で連続として +1", async () => {
    mockPrisma.taskStreak.upsert.mockResolvedValue(
      taskStreak({
        id: "s1",
        taskId: "t1",
        childId: "c1",
        currentStreak: 3,
        bestStreak: 3,
        lastAchievedDate: dateUTC("2026-04-27"), // Mon
      }),
    );

    await recordTaskStreak("t1", "c1", dateUTC("2026-04-29"), [1, 3, 5]); // Wed

    expect(mockPrisma.taskStreak.update).toHaveBeenCalledWith({
      where: { taskId_childId: { taskId: "t1", childId: "c1" } },
      data: {
        currentStreak: 4,
        bestStreak: 4,
        lastAchievedDate: expect.any(Date),
      },
    });
  });

  it("月水金: 金曜→月曜で連続として +1（週末は無視）", async () => {
    mockPrisma.taskStreak.upsert.mockResolvedValue(
      taskStreak({
        id: "s1",
        taskId: "t1",
        childId: "c1",
        currentStreak: 5,
        bestStreak: 5,
        lastAchievedDate: dateUTC("2026-05-01"), // Fri
      }),
    );

    await recordTaskStreak("t1", "c1", dateUTC("2026-05-04"), [1, 3, 5]); // Mon

    expect(mockPrisma.taskStreak.update).toHaveBeenCalledWith({
      where: { taskId_childId: { taskId: "t1", childId: "c1" } },
      data: {
        currentStreak: 6,
        bestStreak: 6,
        lastAchievedDate: expect.any(Date),
      },
    });
  });

  it("月水金: 月曜を逃して水曜に達成 → 1にリセット", async () => {
    mockPrisma.taskStreak.upsert.mockResolvedValue(
      taskStreak({
        id: "s1",
        taskId: "t1",
        childId: "c1",
        currentStreak: 5,
        bestStreak: 10,
        lastAchievedDate: dateUTC("2026-04-24"), // Fri last week (skipped Mon 04-27)
      }),
    );

    await recordTaskStreak("t1", "c1", dateUTC("2026-04-29"), [1, 3, 5]); // Wed

    expect(mockPrisma.taskStreak.update).toHaveBeenCalledWith({
      where: { taskId_childId: { taskId: "t1", childId: "c1" } },
      data: {
        currentStreak: 1,
        bestStreak: 10, // best is preserved
        lastAchievedDate: expect.any(Date),
      },
    });
  });

  it("毎日: 昨日完了済み → +1（現状の挙動を維持）", async () => {
    mockPrisma.taskStreak.upsert.mockResolvedValue(
      taskStreak({
        id: "s1",
        taskId: "t1",
        childId: "c1",
        currentStreak: 7,
        bestStreak: 7,
        lastAchievedDate: dateUTC("2026-04-28"),
      }),
    );

    await recordTaskStreak("t1", "c1", dateUTC("2026-04-29"), [0, 1, 2, 3, 4, 5, 6]);

    expect(mockPrisma.taskStreak.update).toHaveBeenCalledWith({
      where: { taskId_childId: { taskId: "t1", childId: "c1" } },
      data: {
        currentStreak: 8,
        bestStreak: 8,
        lastAchievedDate: expect.any(Date),
      },
    });
  });

  it("同日2回目の承認では更新しない（冪等）", async () => {
    mockPrisma.taskStreak.upsert.mockResolvedValue(
      taskStreak({
        id: "s1",
        taskId: "t1",
        childId: "c1",
        currentStreak: 3,
        bestStreak: 5,
        lastAchievedDate: dateUTC("2026-04-29"),
      }),
    );

    await recordTaskStreak("t1", "c1", dateUTC("2026-04-29"), [1, 3, 5]);

    expect(mockPrisma.taskStreak.update).not.toHaveBeenCalled();
  });

  it("repeatDays が空でも実行できる（途切れ扱い: 1にリセット）", async () => {
    // 通常運用では isTemporary=false かつ repeatDays=[] というケースは無いが、
    // 防御的に呼ばれた場合に例外を投げず 1 にリセットされる
    mockPrisma.taskStreak.upsert.mockResolvedValue(
      taskStreak({
        id: "s1",
        taskId: "t1",
        childId: "c1",
        currentStreak: 5,
        bestStreak: 8,
        lastAchievedDate: dateUTC("2026-04-28"),
      }),
    );

    await recordTaskStreak("t1", "c1", dateUTC("2026-04-29"), []);

    expect(mockPrisma.taskStreak.update).toHaveBeenCalledWith({
      where: { taskId_childId: { taskId: "t1", childId: "c1" } },
      data: {
        currentStreak: 1,
        bestStreak: 8,
        lastAchievedDate: expect.any(Date),
      },
    });
  });
});
