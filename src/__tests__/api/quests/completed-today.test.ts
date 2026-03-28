import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/quests/completed-today/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parentUser, childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-12T14:30:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/quests/completed-today", () => {
  it("未認証の場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("CHILDロールの場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("familyIdがない場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as any);
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("今日報告済みのクエストを返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);

    const quests = [
      {
        id: "q1",
        status: "APPROVED",
        reportedAt: new Date("2026-03-12T10:00:00"),
        approvedAt: new Date("2026-03-13T08:00:00"), // 翌日承認でも今日報告なら表示
        child: { name: "太郎", monsterName: "ドラゴン", side: "DARK" },
        template: { title: "宿題", emoji: "📚", category: "STUDY", difficulty: "NORMAL" },
      },
    ];
    mockPrisma.questInstance.findMany.mockResolvedValue(quests as any);

    const res = await GET();
    const json = await res.json();

    expect(json).toHaveLength(1);
    expect(json[0].child.name).toBe("太郎");
  });

  it("templateにisTemporaryが含まれること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);

    const quests = [
      {
        id: "q1",
        templateId: "tpl-1",
        status: "SKIPPED",
        reportedAt: new Date("2026-03-12T10:00:00"),
        approvedAt: new Date("2026-03-12T11:00:00"),
        child: { name: "太郎", monsterName: "ドラゴン", side: "DARK" },
        template: { title: "英語", emoji: "📖", category: "STUDY", difficulty: "EASY", isTemporary: true },
      },
    ];
    mockPrisma.questInstance.findMany.mockResolvedValue(quests as any);

    const res = await GET();
    const json = await res.json();

    expect(json[0].template.isTemporary).toBe(true);
    expect(json[0].templateId).toBe("tpl-1");
  });

  it("今日の日付範囲（00:00〜翌日00:00）でreportedAtをフィルタすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

    await GET();

    const today = new Date("2026-03-12T00:00:00");
    const tomorrow = new Date("2026-03-13T00:00:00");

    expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["APPROVED", "SKIPPED"] },
          reportedAt: {
            gte: today,
            lt: tomorrow,
          },
          template: { familyId: "fam-1" },
        }),
        orderBy: { reportedAt: "desc" },
      })
    );
  });
});
