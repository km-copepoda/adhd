import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/tasks/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest } from "../../helpers/request";
import { parentUser, childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/tasks", () => {
  it("未認証の場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it("familyIdがない場合、空配列を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as any);
    const res = await GET();
    const json = await res.json();
    expect(json).toEqual([]);
  });

  it("ファミリーのアクティブタスクを返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const tasks = [
      { id: "t1", title: "宿題", isActive: true },
      { id: "t2", title: "運動", isActive: true },
    ];
    mockPrisma.taskTemplate.findMany.mockResolvedValue(tasks as any);

    const res = await GET();
    const json = await res.json();

    expect(json).toEqual(tasks);
    expect(mockPrisma.taskTemplate.findMany).toHaveBeenCalledWith({
      where: { familyId: "fam-1", isActive: true },
      include: {
        assignedChild: { select: { id: true, monsterName: true } },
        taskStreaks: {
          select: { childId: true, currentStreak: true, bestStreak: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  });
});

describe("POST /api/tasks", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/tasks", { title: "test" }));
    expect(res.status).toBe(403);
  });

  it("familyIdなしの場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as any);
    const res = await POST(makeRequest("/api/tasks", { title: "test" }));
    expect(res.status).toBe(403);
  });

  it("通常タスクを作成できること（PARENT）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const created = { id: "t-new", title: "漢字練習", isTemporary: false };
    mockPrisma.taskTemplate.create.mockResolvedValue(created as any);

    const res = await POST(
      makeRequest("/api/tasks", {
        title: "漢字練習",
        emoji: "✏️",
        category: "STUDY",
        difficulty: "NORMAL",
        repeatDays: [1, 2, 3, 4, 5],
        assignedChildId: "child-1",
      })
    );
    const json = await res.json();

    expect(json.id).toBe("t-new");
    expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
      data: {
        title: "漢字練習",
        emoji: "✏️",
        category: "STUDY",
        difficulty: "NORMAL",
        repeatDays: [1, 2, 3, 4, 5],
        isTemporary: false,
        targetDate: null,
        requestedDate: null,
        createdBy: "PARENT",
        familyId: "fam-1",
        assignedChildId: "child-1",
      },
    });
  });

  it("一時タスクを作成できること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.taskTemplate.create.mockResolvedValue({ id: "t-temp" } as any);

    await POST(
      makeRequest("/api/tasks", {
        title: "特別掃除",
        category: "LIFE",
        difficulty: "HARD",
        isTemporary: true,
        targetDate: "2026-03-12",
      })
    );

    expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isTemporary: true,
        repeatDays: [],
        targetDate: new Date("2026-03-12"),
        createdBy: "CHILD",
      }),
    });
  });

  it("一時タスクでtargetDateがない場合、当日の日付が設定されること", async () => {
    vi.setSystemTime(new Date("2026-03-12T09:00:00"));
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.taskTemplate.create.mockResolvedValue({ id: "t-temp2" } as any);

    await POST(
      makeRequest("/api/tasks", {
        title: "今日のタスク",
        category: "STAMINA",
        difficulty: "EASY",
        isTemporary: true,
      })
    );

    const today = new Date("2026-03-12T00:00:00");
    today.setHours(0, 0, 0, 0);
    expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isTemporary: true,
        targetDate: today,
      }),
    });
  });

  it("emojiが未指定の場合、デフォルト ⚔️ を使用すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.taskTemplate.create.mockResolvedValue({ id: "t-def" } as any);

    await POST(
      makeRequest("/api/tasks", { title: "テスト", category: "STUDY", difficulty: "EASY", assignedChildId: "child-1" })
    );

    expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ emoji: "⚔️" }),
    });
  });

  it("repeatDaysが未指定かつ非一時タスクの場合、空配列になること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.taskTemplate.create.mockResolvedValue({ id: "t-norep" } as any);

    await POST(
      makeRequest("/api/tasks", { title: "テスト", category: "STUDY", difficulty: "EASY", assignedChildId: "child-1" })
    );

    expect(mockPrisma.taskTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ repeatDays: [] }),
    });
  });
});
