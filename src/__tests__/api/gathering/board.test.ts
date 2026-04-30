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

  it("子供: date未指定は今日(JST)のログのみ返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue({ groupId: "g-1" } as never);
    vi.mocked(prisma.bulletinLog.findMany).mockResolvedValue([
      { id: "log-1", groupId: "g-1", childId: "child-1", type: "TASK_STARTED", message: "太郎がスタート！", date: todayJST(), createdAt: new Date() },
    ] as never);

    const res = await GET(makeGetRequest("/api/gathering/board"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);

    const call = vi.mocked(prisma.bulletinLog.findMany).mock.calls[0][0]!;
    const where = call.where as { groupId: string; date: Date };
    expect(where.groupId).toBe("g-1");
    expect(where.date.getTime()).toBe(todayJST().getTime());
  });

  it("子供: date=YYYY-MM-DDで指定日のログのみ返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue({ groupId: "g-1" } as never);

    // 2日前（直近4日のretention窓内）を相対日付で生成
    const targetDate = new Date(todayJST().getTime() - 2 * 86400000);
    const dateStr = targetDate.toISOString().slice(0, 10);

    vi.mocked(prisma.bulletinLog.findMany).mockResolvedValue([
      { id: "log-2", groupId: "g-1", childId: "child-1", type: "BADGE_UNLOCKED", message: "太郎はバッジを手に入れた！", date: targetDate, createdAt: new Date(targetDate.getTime() + 10 * 3600 * 1000) },
    ] as never);

    const res = await GET(makeGetRequest(`/api/gathering/board?date=${dateStr}`));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);

    const call = vi.mocked(prisma.bulletinLog.findMany).mock.calls[0][0]!;
    const where = call.where as { date: Date };
    // JST日付は UTC 0:00 として保存される (todayJST規約)
    expect(where.date.toISOString().slice(0, 10)).toBe(dateStr);
  });

  it("子供: dateが4日より前は空配列(古いログは取得不可)", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue({ groupId: "g-1" } as never);

    // 5日前を指定
    const fiveDaysAgo = new Date(todayJST().getTime() - 5 * 86400000);
    const dateStr = fiveDaysAgo.toISOString().slice(0, 10);

    const res = await GET(makeGetRequest(`/api/gathering/board?date=${dateStr}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(prisma.bulletinLog.findMany).not.toHaveBeenCalled();
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

  it("親: 自分のファミリーの子供のログを返す（date指定可）", async () => {
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
