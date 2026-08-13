import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/quests/completed-today/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, questInstance } from "../../helpers/fixtures";
import type { Prisma } from "@/generated/prisma/client";

type CompletedTodayQuest = Prisma.QuestInstanceGetPayload<{
  include: {
    child: { select: { name: true; monsterName: true; side: true } };
    template: {
      select: {
        title: true;
        emoji: true;
        category: true;
        isTemporary: true;
        photoBonus: true;
      };
    };
  };
}>;

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
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("familyIdがない場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }));
    const res = await GET();
    expect(await res.json()).toEqual([]);
  });

  it("今日報告済みのクエストを返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

    // snapshotTitle/Emoji/Category は旧データ（スキーマ導入前）を再現するため
    // undefined 指定で欠落させ、template フォールバック分岐のカバレッジを維持する
    const quests: CompletedTodayQuest[] = [
      {
        ...questInstance({
          id: "q1",
          status: "APPROVED",
          reportedAt: new Date("2026-03-12T10:00:00"),
          approvedAt: new Date("2026-03-13T08:00:00"), // 翌日承認でも今日報告なら表示
          snapshotTitle: undefined,
          snapshotEmoji: undefined,
          snapshotCategory: undefined,
        }),
        child: { name: "太郎", monsterName: "ドラゴン", side: "DARK" },
        template: { title: "宿題", emoji: "📚", category: "STUDY", isTemporary: false, photoBonus: false },
      },
    ];
    prismaMock.questInstance.findMany.mockResolvedValue(quests);

    const res = await GET();
    const json = await res.json();

    expect(json).toHaveLength(1);
    expect(json[0].child.name).toBe("太郎");
  });

  it("templateにisTemporaryが含まれること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

    const quests: CompletedTodayQuest[] = [
      {
        ...questInstance({
          id: "q1",
          templateId: "tpl-1",
          status: "SKIPPED",
          reportedAt: new Date("2026-03-12T10:00:00"),
          approvedAt: new Date("2026-03-12T11:00:00"),
          snapshotTitle: undefined,
          snapshotEmoji: undefined,
          snapshotCategory: undefined,
        }),
        child: { name: "太郎", monsterName: "ドラゴン", side: "DARK" },
        template: { title: "英語", emoji: "📖", category: "STUDY", isTemporary: true, photoBonus: false },
      },
    ];
    prismaMock.questInstance.findMany.mockResolvedValue(quests);

    const res = await GET();
    const json = await res.json();

    expect(json[0].template.isTemporary).toBe(true);
    expect(json[0].templateId).toBe("tpl-1");
  });

  it("今日の日付範囲（00:00〜翌日00:00）でreportedAtをフィルタすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([]);

    await GET();

    const today = new Date("2026-03-12T00:00:00");
    const tomorrow = new Date("2026-03-13T00:00:00");

    expect(prismaMock.questInstance.findMany).toHaveBeenCalledWith(
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
