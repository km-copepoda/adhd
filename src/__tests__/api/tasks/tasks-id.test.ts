import { describe, it, expect, vi, beforeEach } from "vitest";
import { PUT, PATCH, DELETE } from "@/app/api/tasks/[id]/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest, makeParams } from "../../helpers/request";
import { parentUser, childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── PUT /api/tasks/[id] ─────────────────────────────

describe("PUT /api/tasks/[id]", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await PUT(makeRequest("/api/tasks/t1", { title: "test" }), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("CHILDロールの場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await PUT(makeRequest("/api/tasks/t1", { title: "test" }), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("PARENTがタスクを更新できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const updated = { id: "t1", title: "更新後" };
    mockPrisma.taskTemplate.update.mockResolvedValue(updated as any);

    const res = await PUT(
      makeRequest("/api/tasks/t1", {
        title: "更新後",
        emoji: "📝",
        category: "STUDY",
        difficulty: "HARD",
        repeatDays: [0, 6],
      }),
      makeParams("t1")
    );
    const json = await res.json();

    expect(json.title).toBe("更新後");
    expect(mockPrisma.taskTemplate.update).toHaveBeenCalledWith({
      where: { id: "t1", familyId: "fam-1" },
      data: {
        title: "更新後",
        emoji: "📝",
        category: "STUDY",
        difficulty: "HARD",
        repeatDays: [0, 6],
        requirePhoto: undefined,
      },
    });
  });

  it("requirePhoto=true を指定してタスクを更新できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.taskTemplate.update.mockResolvedValue({ id: "t1", requirePhoto: true } as any);

    const res = await PUT(
      makeRequest("/api/tasks/t1", {
        title: "宿題",
        emoji: "📝",
        category: "STUDY",
        difficulty: "NORMAL",
        repeatDays: [1, 2, 3, 4, 5],
        requirePhoto: true,
      }),
      makeParams("t1")
    );
    const json = await res.json();

    expect(json.requirePhoto).toBe(true);
    expect(mockPrisma.taskTemplate.update).toHaveBeenCalledWith({
      where: { id: "t1", familyId: "fam-1" },
      data: expect.objectContaining({ requirePhoto: true }),
    });
  });

  it("familyIdがnullのPARENTは403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as any);
    const res = await PUT(
      makeRequest("/api/tasks/t1", { title: "test" }),
      makeParams("t1")
    );
    expect(res.status).toBe(403);
  });
});

// ─── PATCH /api/tasks/[id] ───────────────────────────

describe("PATCH /api/tasks/[id]", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await PATCH(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("CHILDロールの場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await PATCH(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("PARENTが仮タスクを承認（createdBy→PARENT）できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.taskTemplate.update.mockResolvedValue({ id: "t1", createdBy: "PARENT" } as any);

    const res = await PATCH(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    const json = await res.json();

    expect(json.createdBy).toBe("PARENT");
    expect(mockPrisma.taskTemplate.update).toHaveBeenCalledWith({
      where: { id: "t1", familyId: "fam-1" },
      data: { createdBy: "PARENT" },
    });
  });
});

// ─── DELETE /api/tasks/[id] ──────────────────────────

describe("DELETE /api/tasks/[id]", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await DELETE(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("子供が自分の一時タスクを削除できること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.taskTemplate.findFirst.mockResolvedValue({ id: "t1", createdBy: "CHILD" } as any);
    mockPrisma.taskTemplate.update.mockResolvedValue({ id: "t1", isActive: false } as any);

    const res = await DELETE(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(mockPrisma.taskTemplate.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { isActive: false },
    });
  });

  it("子供が他人のタスクを削除できないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.taskTemplate.findFirst.mockResolvedValue(null);

    const res = await DELETE(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("親が仮タスクを却下する際、完了済みクエストのXPを差し引くこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);

    mockPrisma.taskTemplate.findUnique.mockResolvedValue({
      id: "t1",
      createdBy: "CHILD",
      difficulty: "NORMAL", // XP=3
      category: "STUDY",
      quests: [
        {
          id: "q1",
          status: "REPORTED",
          child: { id: "child-1", studyPt: 10, staminaPt: 5, lifePt: 3 },
        },
        {
          id: "q2",
          status: "APPROVED",
          child: { id: "child-1", studyPt: 10, staminaPt: 5, lifePt: 3 },
        },
      ],
    } as any);

    mockPrisma.user.update.mockResolvedValue({} as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);
    mockPrisma.taskTemplate.update.mockResolvedValue({} as any);

    const res = await DELETE(makeRequest("/api/tasks/t1", {}), makeParams("t1"));
    const json = await res.json();

    expect(json.ok).toBe(true);
    // XP差し引き: STUDY -3 (NORMAL difficulty)
    expect(mockPrisma.user.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: {
        studyPt: 7, // 10 - 3
        staminaPt: 5,
        lifePt: 3,
      },
    });
    // クエストをREJECTEDに
    expect(mockPrisma.questInstance.update).toHaveBeenCalledTimes(2);
    expect(mockPrisma.questInstance.update).toHaveBeenCalledWith({
      where: { id: "q1" },
      data: { status: "REJECTED" },
    });
  });

  it("親がPARENT作成タスクを削除する際、XP差し引きしないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);

    mockPrisma.taskTemplate.findUnique.mockResolvedValue({
      id: "t2",
      createdBy: "PARENT",
      quests: [],
    } as any);
    mockPrisma.taskTemplate.update.mockResolvedValue({} as any);

    const res = await DELETE(makeRequest("/api/tasks/t2", {}), makeParams("t2"));
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("XP差し引きで負数にならないこと（Math.max(0, ...)）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);

    mockPrisma.taskTemplate.findUnique.mockResolvedValue({
      id: "t3",
      createdBy: "CHILD",
      difficulty: "HARD", // XP=5
      category: "STAMINA",
      quests: [
        {
          id: "q3",
          status: "REPORTED",
          child: { id: "child-2", studyPt: 2, staminaPt: 1, lifePt: 0 },
        },
      ],
    } as any);

    mockPrisma.user.update.mockResolvedValue({} as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);
    mockPrisma.taskTemplate.update.mockResolvedValue({} as any);

    await DELETE(makeRequest("/api/tasks/t3", {}), makeParams("t3"));

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-2" },
      data: {
        studyPt: 2,
        staminaPt: 0, // Math.max(0, 1-5) = 0
        lifePt: 0,
      },
    });
  });
});
