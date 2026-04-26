import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/gathering/board/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
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

  it("子供: グループ参加中はログを返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue({ groupId: "g-1" } as never);
    const mockLogs = [
      { id: "log-1", groupId: "g-1", childId: "child-1", type: "TASK_STARTED", message: "太郎がスタート！", date: new Date("2026-04-26"), createdAt: new Date() },
    ];
    vi.mocked(prisma.bulletinLog.findMany).mockResolvedValue(mockLogs as never);

    const res = await GET(makeGetRequest("/api/gathering/board"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].type).toBe("TASK_STARTED");
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
      { id: "log-2", type: "BADGE_UNLOCKED", message: "太郎はバッジを手に入れた！", createdAt: new Date() },
    ] as never);

    const res = await GET(makeGetRequest("/api/gathering/board?childId=child-1"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data[0].type).toBe("BADGE_UNLOCKED");
  });
});
