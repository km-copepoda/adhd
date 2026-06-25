import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { GET } from "@/app/api/checkin/calendar/route";
import { childUser, parentUser, streak } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

function makeRequest(url: string): Request {
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  // 今日を 2026-06-25 (JST) に固定
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-25T03:00:00Z")); // JST 12:00
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/checkin/calendar", () => {
  it("未認証は 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/checkin/calendar"));
    expect(res.status).toBe(401);
  });

  it("親ユーザーは 403", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await GET(makeRequest("http://localhost/api/checkin/calendar"));
    expect(res.status).toBe(403);
  });

  it("days が範囲外は 400", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await GET(makeRequest("http://localhost/api/checkin/calendar?days=0"));
    expect(res.status).toBe(400);

    const res2 = await GET(makeRequest("http://localhost/api/checkin/calendar?days=32"));
    expect(res2.status).toBe(400);

    const res3 = await GET(makeRequest("http://localhost/api/checkin/calendar?days=abc"));
    expect(res3.status).toBe(400);
  });

  it("直近 7 日のログ + enabledSince + ストリークを返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ checkinDeadlineTime: "16:00" }) as any);
    mockPrisma.checkinLog.findMany.mockResolvedValue([
      { date: new Date("2026-06-23T00:00:00Z"), success: true },
      { date: new Date("2026-06-24T00:00:00Z"), success: false },
    ] as any);
    mockPrisma.checkinLog.findFirst.mockResolvedValue({
      date: new Date("2026-06-22T00:00:00Z"),
    } as any);
    mockPrisma.streak.findUnique.mockResolvedValue(
      streak({ checkinCurrentStreak: 5, checkinBestStreak: 12 }) as any,
    );

    const res = await GET(makeRequest("http://localhost/api/checkin/calendar"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.enabled).toBe(true);
    expect(json.days).toBe(7);
    expect(json.logs).toEqual([
      { date: "2026-06-23", success: true },
      { date: "2026-06-24", success: false },
    ]);
    expect(json.enabledSince).toBe("2026-06-22");
    expect(json.currentStreak).toBe(5);
    expect(json.bestStreak).toBe(12);
    expect(json.deadline).toBe("16:00");
  });

  it("checkinDeadlineTime が未設定なら enabled=false で空", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ checkinDeadlineTime: null }) as any);

    const res = await GET(makeRequest("http://localhost/api/checkin/calendar"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.enabled).toBe(false);
    expect(json.logs).toEqual([]);
    expect(json.enabledSince).toBeNull();
  });

  it("CheckinLog が 1 件もなければ enabledSince=今日（過去全部を空表示に）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ checkinDeadlineTime: "16:00" }) as any);
    mockPrisma.checkinLog.findMany.mockResolvedValue([] as any);
    mockPrisma.checkinLog.findFirst.mockResolvedValue(null);
    mockPrisma.streak.findUnique.mockResolvedValue(streak() as any);

    const res = await GET(makeRequest("http://localhost/api/checkin/calendar"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.enabledSince).toBe("2026-06-25");
  });

  it("直近 days 日（既定 7）の範囲のみクエリすること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ checkinDeadlineTime: "16:00" }) as any);
    mockPrisma.checkinLog.findMany.mockResolvedValue([] as any);
    mockPrisma.checkinLog.findFirst.mockResolvedValue(null);
    mockPrisma.streak.findUnique.mockResolvedValue(streak() as any);

    await GET(makeRequest("http://localhost/api/checkin/calendar"));

    expect(mockPrisma.checkinLog.findMany).toHaveBeenCalledWith({
      where: {
        childId: "child-1",
        date: {
          // 今日 (6/25) から 7 日前 = 6/19 〜 6/25
          gte: new Date("2026-06-19T00:00:00Z"),
          lte: new Date("2026-06-25T00:00:00Z"),
        },
      },
      orderBy: { date: "asc" },
      select: { date: true, success: true },
    });
  });
});
