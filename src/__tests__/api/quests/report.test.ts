import { describe, it, expect, vi, beforeEach } from "vitest";
import { after } from "next/server";
import { POST } from "@/app/api/quests/[id]/report/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { triggerTaskProgressLog } from "@/lib/bulletinLog";
import { generateTreasuresOnReport } from "@/lib/treasureService";
import { makeRequest, makeParams } from "../../helpers/request";
import { childUser } from "../../helpers/fixtures";

vi.mock("@/lib/bulletinLog", () => ({
  triggerTaskProgressLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/treasureService", () => ({
  generateTreasuresOnReport: vi.fn().mockResolvedValue([]),
}));

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockAfter = vi.mocked(after);
const mockTriggerTaskProgressLog = vi.mocked(triggerTaskProgressLog);
const mockGenerateTreasures = vi.mocked(generateTreasuresOnReport);

beforeEach(() => {
  vi.clearAllMocks();
  // 当日の集計を取りに行く findMany のデフォルト（宝箱ロジック向け）
  mockPrisma.questInstance.findMany.mockResolvedValue([]);
  mockGenerateTreasures.mockResolvedValue([]);
});

describe("POST /api/quests/[id]/report", () => {
  const baseUser = childUser({ studyPt: 5, staminaPt: 3, lifePt: 1 });

  const baseQuest = {
    id: "q1",
    childId: "child-1",
    status: "PENDING",
    date: new Date("2026-03-28T00:00:00.000Z"), // 2026-03-28 JST
    deadlineBonusEarned: false,
    template: { category: "STUDY", photoBonus: false },
  };

  it("未認証の場合、401を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/quests/q1/report", { comment: "" }), makeParams("q1"));
    expect(res.status).toBe(401);
  });

  it("存在しないクエストで404を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(baseUser as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue(null);

    const res = await POST(
      makeRequest("/api/quests/q-notfound/report", { comment: "" }),
      makeParams("q-notfound"),
    );
    expect(res.status).toBe(404);
  });

  it("クエスト報告でステータスがREPORTEDに更新されること", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...baseUser } as any); // reportDeadlineTime なし
    mockPrisma.questInstance.findUnique.mockResolvedValue(baseQuest as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(
      makeRequest("/api/quests/q1/report", { comment: "がんばった" }),
      makeParams("q1"),
    );
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.category).toBe("STUDY");

    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: expect.objectContaining({
        status: "REPORTED",
        comment: "がんばった",
      }),
    });

    // XPは承認時付与のため、報告時にはuser.updateしない
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("期限なしの場合、xpAdded=1（基本のみ）を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...baseUser, reportDeadlineTime: null } as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue(baseQuest as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(
      makeRequest("/api/quests/q1/report", { comment: "" }),
      makeParams("q1"),
    );
    const json = await res.json();

    expect(json.xpAdded).toBe(1);
  });

  it("期限前に報告した場合、xpAdded=2でdeadlineBonusEarned=trueが保存されること", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...baseUser, familyId: "fam-1", reportDeadlineTime: "20:00" } as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      ...baseQuest,
      status: "PENDING",
      date: new Date("2026-03-28T00:00:00.000Z"),
    } as any);
    // 現在時刻: 2026-03-28T09:30:00Z = 18:30 JST < 20:00 JST (期限前)
    vi.setSystemTime(new Date("2026-03-28T09:30:00Z"));
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(
      makeRequest("/api/quests/q1/report", { comment: "" }),
      makeParams("q1"),
    );
    const json = await res.json();

    expect(json.xpAdded).toBe(2);
    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: expect.objectContaining({
        deadlineBonusEarned: true,
      }),
    });
    vi.useRealTimers();
  });

  it("期限後に報告した場合、deadlineBonusEarned=falseが保存されること", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...baseUser, familyId: "fam-1", reportDeadlineTime: "20:00" } as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      ...baseQuest,
      status: "PENDING",
      date: new Date("2026-03-28T00:00:00.000Z"),
    } as any);
    // 現在時刻: 2026-03-28T12:30:00Z = 21:30 JST > 20:00 JST (期限後)
    vi.setSystemTime(new Date("2026-03-28T12:30:00Z"));
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(
      makeRequest("/api/quests/q1/report", { comment: "" }),
      makeParams("q1"),
    );
    const json = await res.json();

    expect(json.xpAdded).toBe(1);
    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: expect.objectContaining({
        deadlineBonusEarned: false,
      }),
    });
    vi.useRealTimers();
  });

  it("差し戻し後の再報告ではdeadlineBonusEarnedを変更しないこと", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...baseUser, familyId: "fam-1", reportDeadlineTime: "20:00" } as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      ...baseQuest,
      status: "REJECTED",
      deadlineBonusEarned: true, // 初回報告時に設定済み
    } as any);
    // 現在時刻は期限後
    vi.setSystemTime(new Date("2026-03-28T12:30:00Z"));
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(
      makeRequest("/api/quests/q1/report", { comment: "やり直した" }),
      makeParams("q1"),
    );
    const json = await res.json();

    // 差し戻し後なのでdeadlineBonusEarned=trueが維持される
    expect(json.xpAdded).toBe(2); // 1基本 + 1期限(初回)
    // updateにdeadlineBonusEarnedが含まれないこと（変更しない）
    const updateCall = mockPrisma.questInstance.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty("deadlineBonusEarned");
    vi.useRealTimers();
  });

  it("photoBonus=true かつ写真あり、xpAdded=2", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...baseUser, reportDeadlineTime: null } as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      ...baseQuest,
      template: { ...baseQuest.template, photoBonus: true },
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const photoUrl = "https://example.com/storage/quest-photos/q1.jpg";
    const res = await POST(
      makeRequest("/api/quests/q1/report", { comment: "", photoUrl }),
      makeParams("q1"),
    );
    const json = await res.json();

    expect(json.xpAdded).toBe(2);
  });

  it("期限ボーナス+写真ボーナスで xpAdded=3", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...baseUser, familyId: "fam-1", reportDeadlineTime: "20:00" } as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      ...baseQuest,
      status: "PENDING",
      date: new Date("2026-03-28T00:00:00.000Z"),
      template: { ...baseQuest.template, photoBonus: true },
    } as any);
    vi.setSystemTime(new Date("2026-03-28T09:30:00Z")); // 18:30 JST (期限前)
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const photoUrl = "https://example.com/storage/quest-photos/q1.jpg";
    const res = await POST(
      makeRequest("/api/quests/q1/report", { comment: "", photoUrl }),
      makeParams("q1"),
    );
    const json = await res.json();

    expect(json.xpAdded).toBe(3);
    vi.useRealTimers();
  });

  it("photoBonus=false の場合、写真があってもボーナスなし", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...baseUser, reportDeadlineTime: null } as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      ...baseQuest,
      template: { ...baseQuest.template, photoBonus: false },
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(
      makeRequest("/api/quests/q1/report", { comment: "", photoUrl: "https://example.com/photo.jpg" }),
      makeParams("q1"),
    );
    const json = await res.json();

    expect(json.xpAdded).toBe(1);
  });

  it("コメントなし（空文字）でも報告できること", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...baseUser, reportDeadlineTime: null } as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      ...baseQuest,
      template: { ...baseQuest.template, photoBonus: false },
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(
      makeRequest("/api/quests/q5/report", { comment: "" }),
      makeParams("q5"),
    );
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
      where: { id: "q5" },
      data: expect.objectContaining({
        status: "REPORTED",
        comment: "",
      }),
    });
  });

  it("写真なしでも報告できること（photoBonus=trueでも必須ではない）", async () => {
    mockGetCurrentUser.mockResolvedValue(baseUser as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      ...baseQuest,
      template: { ...baseQuest.template, photoBonus: true },
    } as any);
    mockPrisma.family.findUnique.mockResolvedValue(null);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(
      makeRequest("/api/quests/q6/report", { comment: "やった" }),
      makeParams("q6"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.xpAdded).toBe(1); // 写真なしなのでボーナスなし
  });

  it("掲示板ログは next/server の after() 経由でスケジュールされる（fire-and-forget だとサーバレスで取りこぼされる）", async () => {
    mockGetCurrentUser.mockResolvedValue(baseUser as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue(baseQuest as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    await POST(
      makeRequest("/api/quests/q1/report", { comment: "100%達成" }),
      makeParams("q1"),
    );

    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockTriggerTaskProgressLog).toHaveBeenCalledWith("child-1");
  });

  // ─── 宝箱（ごほうび）統合 ───────────────────────────────────────
  describe("宝箱生成", () => {
    it("minTasks 達成（部分完了）→ STREAK 宝箱1個", async () => {
      mockGetCurrentUser.mockResolvedValue({
        ...baseUser,
        minTasksForStreak: 1,
        reportDeadlineTime: null,
      } as any);
      mockPrisma.questInstance.findUnique.mockResolvedValue(baseQuest as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);
      // 当日3個のうち今回の1個だけが REPORTED
      mockPrisma.questInstance.findMany.mockResolvedValue([
        { status: "REPORTED" } as any,
        { status: "PENDING" } as any,
        { status: "PENDING" } as any,
      ]);
      mockGenerateTreasures.mockResolvedValue(["t-streak"]);

      const res = await POST(
        makeRequest("/api/quests/q1/report", { comment: "" }),
        makeParams("q1"),
      );
      const json = await res.json();

      expect(mockGenerateTreasures).toHaveBeenCalledWith({
        childId: "child-1",
        date: baseQuest.date,
        reportedCount: 1,
        totalCount: 3,
        skippedCount: 0,
        minTasks: 1,
        isProxy: false,
      });
      expect(json.treasureIds).toEqual(["t-streak"]);
    });

    it("全完了 → STREAK + ALL_COMPLETE で2個", async () => {
      mockGetCurrentUser.mockResolvedValue({
        ...baseUser,
        minTasksForStreak: 1,
        reportDeadlineTime: null,
      } as any);
      mockPrisma.questInstance.findUnique.mockResolvedValue(baseQuest as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);
      mockPrisma.questInstance.findMany.mockResolvedValue([
        { status: "REPORTED" } as any,
        { status: "APPROVED" } as any,
        { status: "SKIPPED" } as any,
      ]);
      mockGenerateTreasures.mockResolvedValue(["t-streak", "t-all"]);

      const res = await POST(
        makeRequest("/api/quests/q1/report", { comment: "" }),
        makeParams("q1"),
      );
      const json = await res.json();

      expect(mockGenerateTreasures).toHaveBeenCalledWith({
        childId: "child-1",
        date: baseQuest.date,
        reportedCount: 3,
        totalCount: 3,
        skippedCount: 1, // SKIPPED が 1 件含まれるので boost 抑止用に渡る
        minTasks: 1,
        isProxy: false,
      });
      expect(json.treasureIds).toEqual(["t-streak", "t-all"]);
    });

    it("minTasks 未達なら宝箱なしでも 200 を返す", async () => {
      mockGetCurrentUser.mockResolvedValue({
        ...baseUser,
        minTasksForStreak: 3,
        reportDeadlineTime: null,
      } as any);
      mockPrisma.questInstance.findUnique.mockResolvedValue(baseQuest as any);
      mockPrisma.questInstance.update.mockResolvedValue({} as any);
      mockPrisma.questInstance.findMany.mockResolvedValue([
        { status: "REPORTED" } as any,
        { status: "PENDING" } as any,
        { status: "PENDING" } as any,
      ]);
      mockGenerateTreasures.mockResolvedValue([]);

      const res = await POST(
        makeRequest("/api/quests/q1/report", { comment: "" }),
        makeParams("q1"),
      );
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.treasureIds).toEqual([]);
    });
  });
});
