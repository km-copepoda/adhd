import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/cron/auto-approve/route";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { questInstance, childUser } from "../../helpers/fixtures";

// Issue #108: auto-approve cron 経由でも「開かずの宝箱」バグが再現することを確認する。
// この describe ブロックは @/lib/approve / @/lib/treasureService を **モックしない**。
// cron → approveQuestInstance / approveSkipQuestInstance → unlockTreasuresOnApprove
// (実装) → prisma.treasureLog.updateMany まで実際に通し、carryOver 過去日付タスクが
// 承認日ではなく報告日で unlock されることを検証する。
vi.mock("@/lib/streak", () => ({
  recordDailyAchievement: vi.fn().mockResolvedValue(undefined),
  recordTaskStreak: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/badges", () => ({
  checkAndUnlockBadges: vi.fn().mockResolvedValue([]),
}));

function pendingQuest(overrides: {
  id: string;
  status: "REPORTED" | "SKIP_REPORTED";
  date: Date;
  reportedAt: Date | null;
  childId: string;
  templateId: string;
  carryOver: boolean;
}) {
  return {
    ...questInstance({
      id: overrides.id,
      status: overrides.status,
      date: overrides.date,
      reportedAt: overrides.reportedAt,
      childId: overrides.childId,
      templateId: overrides.templateId,
    }),
    template: {
      id: overrides.templateId,
      category: "STUDY" as const,
      createdBy: "PARENT" as const,
      isTemporary: false,
      photoBonus: false,
      repeatDays: [1, 2, 3, 4, 5],
      carryOver: overrides.carryOver,
    },
    child: {
      id: overrides.childId,
      evolutionStage: 0,
      evolutionPath: "",
      collectedPaths: "[]",
      studyPt: 0,
      staminaPt: 0,
      lifePt: 0,
    },
  };
}

function makeRequest(secret?: string) {
  const headers: Record<string, string> = {};
  if (secret !== undefined) {
    headers["authorization"] = `Bearer ${secret}`;
  }
  return new Request("http://localhost/api/cron/auto-approve", {
    method: "GET",
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
  mockPrisma.questDeclaration.findUnique.mockResolvedValue(null);
  mockPrisma.user.findUnique.mockResolvedValue(childUser());
  mockPrisma.questInstance.update.mockResolvedValue(questInstance());
  mockPrisma.user.update.mockResolvedValue(childUser());
  mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/cron/auto-approve 経由の宝箱 unlock 日付解決 (resolveTreasureDate)", () => {
  it("carryOver=true / 古いスケジュール日 / 報告日と承認日(cronの今日)が異なる → 宝箱は報告日で unlock されること", async () => {
    // cron 実行時刻(承認時刻): 2026-08-21 JST 10:00 = UTC 2026-08-21 01:00
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T01:00:00.000Z"));

    const reportedAt = new Date("2026-08-20T14:58:00.000Z"); // JST 8/20 23:58
    const reportDateJST = new Date("2026-08-20T00:00:00.000Z");
    const cronTodayJST = new Date("2026-08-21T00:00:00.000Z");

    mockPrisma.questInstance.findMany.mockResolvedValue([
      pendingQuest({
        id: "q-cron-carry",
        status: "REPORTED",
        date: new Date("2026-08-10T00:00:00.000Z"), // スケジュール上のかなり古い元日付
        reportedAt,
        childId: "child-1",
        templateId: "tpl-1",
        carryOver: true,
      }),
    ] as never);

    const res = await GET(makeRequest("test-secret"));
    expect(res.status).toBe(200);

    // 現行実装 (effectiveTreasureDate が todayJST() を使う) では cron の実行日 (8/21) で
    // updateMany が呼ばれてしまうため、この期待値は Red になる。
    expect(mockPrisma.treasureLog.updateMany).toHaveBeenCalledWith({
      where: { childId: "child-1", date: reportDateJST, status: "LOCKED" },
      data: { status: "UNLOCKED" },
    });
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalledWith({
      where: { childId: "child-1", date: cronTodayJST, status: "LOCKED" },
      data: { status: "UNLOCKED" },
    });
  });

  it("SKIP_REPORTED / carryOver=true でも同様に報告日で unlock されること", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T03:00:00.000Z")); // 承認(cron実行): 8/22

    const reportedAt = new Date("2026-08-20T10:00:00.000Z"); // JST 8/20 19:00
    const reportDateJST = new Date("2026-08-20T00:00:00.000Z");

    mockPrisma.questInstance.findMany.mockResolvedValue([
      pendingQuest({
        id: "q-cron-skip-carry",
        status: "SKIP_REPORTED",
        date: new Date("2026-08-19T00:00:00.000Z"),
        reportedAt,
        childId: "child-1",
        templateId: "tpl-1",
        carryOver: true,
      }),
    ] as never);

    const res = await GET(makeRequest("test-secret"));
    expect(res.status).toBe(200);

    expect(mockPrisma.treasureLog.updateMany).toHaveBeenCalledWith({
      where: { childId: "child-1", date: reportDateJST, status: "LOCKED" },
      data: { status: "UNLOCKED" },
    });
  });
});
