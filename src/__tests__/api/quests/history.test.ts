import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/quests/history/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parentUser, childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

function makeRequest(params?: Record<string, string>) {
  const url = new URL("http://localhost/api/quests/history");
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return new Request(url.toString());
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-12T14:30:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/quests/history", () => {
  it("未認証の場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(await res.json()).toEqual([]);
  });

  it("CHILDロールの場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await GET(makeRequest());
    expect(await res.json()).toEqual([]);
  });

  it("familyIdがない場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as any);
    const res = await GET(makeRequest());
    expect(await res.json()).toEqual([]);
  });

  it("date未指定の場合、今日の日付でクエリすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);
    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);

    await GET(makeRequest());

    const today = new Date("2026-03-12T00:00:00");
    expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ date: today }),
      })
    );
  });

  it("dateパラメータで指定した日付のデータを返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);
    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);

    await GET(makeRequest({ date: "2026-03-10" }));

    const targetDate = new Date("2026-03-10T00:00:00");
    expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ date: targetDate }),
      })
    );
  });

  it("APPROVEDクエストをそのまま返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      {
        id: "q1",
        status: "APPROVED",
        date: new Date("2026-03-12"),
        approvedAt: new Date("2026-03-12T10:00:00"),
        comment: null,
        templateId: "tpl-1",
        childId: "child-1",
        child: { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
        template: { title: "宿題", emoji: "📚", category: "STUDY", difficulty: "NORMAL" },
      },
    ] as any);
    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);

    const res = await GET(makeRequest({ date: "2026-03-12" }));
    const json = await res.json();

    expect(json).toHaveLength(1);
    expect(json[0].status).toBe("APPROVED");
    expect(json[0].id).toBe("q1");
  });

  it("SKIPPEDクエストをそのまま返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      {
        id: "q2",
        status: "SKIPPED",
        date: new Date("2026-03-12"),
        approvedAt: new Date("2026-03-12T11:00:00"),
        comment: "体調不良",
        templateId: "tpl-2",
        childId: "child-1",
        child: { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
        template: { title: "運動", emoji: "🏃", category: "STAMINA", difficulty: "EASY" },
      },
    ] as any);
    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);

    const res = await GET(makeRequest({ date: "2026-03-12" }));
    const json = await res.json();

    expect(json).toHaveLength(1);
    expect(json[0].status).toBe("SKIPPED");
    expect(json[0].comment).toBe("体調不良");
  });

  it("PENDINGクエストはNO_ACTIONとして返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      {
        id: "q3",
        status: "PENDING",
        date: new Date("2026-03-12"),
        approvedAt: null,
        comment: null,
        templateId: "tpl-3",
        childId: "child-1",
        child: { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
        template: { title: "読書", emoji: "📖", category: "STUDY", difficulty: "EASY" },
      },
    ] as any);
    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);

    const res = await GET(makeRequest({ date: "2026-03-12" }));
    const json = await res.json();

    expect(json).toHaveLength(1);
    expect(json[0].status).toBe("NO_ACTION");
    expect(json[0].id).toBe("q3");
  });

  it("REPORTEDクエストはNO_ACTIONとして返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      {
        id: "q4",
        status: "REPORTED",
        date: new Date("2026-03-12"),
        approvedAt: null,
        comment: null,
        templateId: "tpl-4",
        childId: "child-1",
        child: { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
        template: { title: "片付け", emoji: "🧹", category: "LIFE", difficulty: "EASY" },
      },
    ] as any);
    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);

    const res = await GET(makeRequest({ date: "2026-03-12" }));
    const json = await res.json();

    expect(json).toHaveLength(1);
    expect(json[0].status).toBe("NO_ACTION");
  });

  it("QuestInstanceのないテンプレートをNO_ACTIONとして返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);
    mockPrisma.taskTemplate.findMany.mockResolvedValue([
      {
        id: "tpl-5",
        title: "お手伝い",
        emoji: "🧹",
        category: "LIFE",
        difficulty: "EASY",
        assignedChildId: "child-1",
        assignedChild: { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
      },
    ] as any);

    const res = await GET(makeRequest({ date: "2026-03-12" }));
    const json = await res.json();

    expect(json).toHaveLength(1);
    expect(json[0].status).toBe("NO_ACTION");
    expect(json[0].id).toBeNull();
    expect(json[0].template.title).toBe("お手伝い");
    expect(json[0].child.name).toBe("太郎");
  });

  it("すでにQuestInstanceがあるテンプレートはNO_ACTIONとして重複しないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([
      {
        id: "q5",
        status: "PENDING",
        date: new Date("2026-03-12"),
        approvedAt: null,
        comment: null,
        templateId: "tpl-6",
        childId: "child-1",
        child: { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
        template: { title: "宿題", emoji: "📚", category: "STUDY", difficulty: "NORMAL" },
      },
    ] as any);
    // Same template also returned by taskTemplate query
    mockPrisma.taskTemplate.findMany.mockResolvedValue([
      {
        id: "tpl-6",
        title: "宿題",
        emoji: "📚",
        category: "STUDY",
        difficulty: "NORMAL",
        assignedChildId: "child-1",
        assignedChild: { id: "child-1", name: "太郎", monsterName: "ドラゴン", side: "LIGHT" },
      },
    ] as any);

    const res = await GET(makeRequest({ date: "2026-03-12" }));
    const json = await res.json();

    // Should have only 1 item (not 2)
    expect(json).toHaveLength(1);
    expect(json[0].id).toBe("q5");
  });

  it("正しい曜日でテンプレートをフィルタすること（2026-03-12は木曜=4）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);
    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);

    // 2026-03-12 is Thursday (day 4)
    await GET(makeRequest({ date: "2026-03-12" }));

    expect(mockPrisma.taskTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          familyId: "fam-1",
          isActive: true,
          OR: expect.arrayContaining([
            expect.objectContaining({ repeatDays: { has: 4 } }),
          ]),
        }),
      })
    );
  });

  it("familyIdでQuestInstanceをフィルタすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);
    mockPrisma.taskTemplate.findMany.mockResolvedValue([] as any);

    await GET(makeRequest({ date: "2026-03-12" }));

    expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          template: { familyId: "fam-1" },
        }),
      })
    );
  });
});
