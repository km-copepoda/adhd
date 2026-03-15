import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/quests/[id]/report/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest, makeParams } from "../../helpers/request";
import { childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/quests/[id]/report", () => {
  const baseUser = childUser({ studyPt: 5, staminaPt: 3, lifePt: 1 });

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
    mockGetCurrentUser.mockResolvedValue({ ...baseUser } as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q1",
      childId: "child-1",
      template: { difficulty: "NORMAL", category: "STUDY" },
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(
      makeRequest("/api/quests/q1/report", { comment: "がんばった" }),
      makeParams("q1"),
    );
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.xpAdded).toBe(3);
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

  it("EASY難易度で1ptが返ること", async () => {
    const user = childUser({ studyPt: 0, staminaPt: 0, lifePt: 0 });
    mockGetCurrentUser.mockResolvedValue(user as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q2",
      childId: "child-1",
      template: { difficulty: "EASY", category: "STAMINA" },
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(
      makeRequest("/api/quests/q2/report", { comment: "" }),
      makeParams("q2"),
    );
    const json = await res.json();

    expect(json.xpAdded).toBe(1);
    expect(json.category).toBe("STAMINA");
  });

  it("HARD難易度で5ptが返ること", async () => {
    const user = childUser({ studyPt: 0, staminaPt: 0, lifePt: 0 });
    mockGetCurrentUser.mockResolvedValue(user as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q4",
      childId: "child-1",
      template: { difficulty: "HARD", category: "LIFE" },
    } as any);
    mockPrisma.questInstance.update.mockResolvedValue({} as any);

    const res = await POST(
      makeRequest("/api/quests/q4/report", { comment: "" }),
      makeParams("q4"),
    );
    const json = await res.json();

    expect(json.xpAdded).toBe(5);
    expect(json.category).toBe("LIFE");
  });

  it("コメントなし（空文字）でも報告できること", async () => {
    mockGetCurrentUser.mockResolvedValue(baseUser as any);
    mockPrisma.questInstance.findUnique.mockResolvedValue({
      id: "q5",
      childId: "child-1",
      template: { difficulty: "NORMAL", category: "STUDY" },
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
});
