import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/gathering/board/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { todayJST } from "@/lib/date";
import { childUser, parentUser } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

function makeGetRequest(url: string) {
  return new Request(`http://localhost${url}`, { method: "GET" });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/gathering/board", () => {
  it("未認証は401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/gathering/board"));
    expect(res.status).toBe(401);
  });

  it("子供: グループ未参加は空配列", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/gathering/board"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("子供: 直近4日(today, -1, -2, -3)のログをdate desc, createdAt descで返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue({ groupId: "g-1" } as never);

    const today = todayJST();
    const yesterday = new Date(today.getTime() - 86400000);
    vi.mocked(prisma.bulletinLog.findMany).mockResolvedValue([
      { id: "log-today", groupId: "g-1", childId: "child-1", type: "TASK_STARTED", message: "今日のログ", date: today, createdAt: new Date() },
      { id: "log-yest", groupId: "g-1", childId: "child-1", type: "BADGE_UNLOCKED", message: "昨日のログ", date: yesterday, createdAt: new Date(today.getTime() - 86400000) },
    ] as never);

    const res = await GET(makeGetRequest("/api/gathering/board"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(2);

    const call = vi.mocked(prisma.bulletinLog.findMany).mock.calls[0][0]!;
    const where = call.where as { groupId: string; date: { gte: Date } };
    expect(where.groupId).toBe("g-1");
    // 4日分 = today, today-1, today-2, today-3 → 下限は today-3
    expect(where.date.gte.getTime()).toBe(today.getTime() - 3 * 86400000);

    const orderBy = call.orderBy as Array<Record<string, "asc" | "desc">>;
    expect(orderBy).toEqual([{ date: "desc" }, { createdAt: "desc" }]);
  });

  it("親: childId未指定は空配列", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    const res = await GET(makeGetRequest("/api/gathering/board"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("親: 他ファミリーの子供は404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    const res = await GET(makeGetRequest("/api/gathering/board?childId=other-child"));
    expect(res.status).toBe(404);
  });

  it("親: 自分のファミリーの子供のログを返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: "child-1" } as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue({ groupId: "g-1" } as never);
    vi.mocked(prisma.bulletinLog.findMany).mockResolvedValue([
      { id: "log-3", type: "BADGE_UNLOCKED", message: "太郎はバッジを手に入れた！", date: todayJST(), createdAt: new Date() },
    ] as never);

    const res = await GET(makeGetRequest("/api/gathering/board?childId=child-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].type).toBe("BADGE_UNLOCKED");
  });
});
