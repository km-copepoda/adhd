import { describe, it, expect, vi, beforeEach } from "vitest";
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
});

describe("GET /api/checkin/calendar", () => {
  it("未認証は 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/checkin/calendar?month=2026-06"));
    expect(res.status).toBe(401);
  });

  it("親ユーザーは 403", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await GET(makeRequest("http://localhost/api/checkin/calendar?month=2026-06"));
    expect(res.status).toBe(403);
  });

  it("不正な month パラメータは 400", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await GET(makeRequest("http://localhost/api/checkin/calendar?month=invalid"));
    expect(res.status).toBe(400);
  });

  it("当月のログを year/month/logs/currentStreak/bestStreak で返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ checkinDeadlineTime: "16:00" }) as any);
    mockPrisma.checkinLog.findMany.mockResolvedValue([
      { date: new Date("2026-06-01T00:00:00Z"), success: true },
      { date: new Date("2026-06-02T00:00:00Z"), success: false },
    ] as any);
    mockPrisma.streak.findUnique.mockResolvedValue(
      streak({ checkinCurrentStreak: 5, checkinBestStreak: 12 }) as any,
    );

    const res = await GET(makeRequest("http://localhost/api/checkin/calendar?month=2026-06"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.year).toBe(2026);
    expect(json.month).toBe(6);
    expect(json.logs).toEqual([
      { date: "2026-06-01", success: true },
      { date: "2026-06-02", success: false },
    ]);
    expect(json.currentStreak).toBe(5);
    expect(json.bestStreak).toBe(12);
    expect(json.deadline).toBe("16:00");
  });

  it("checkinDeadlineTime が未設定なら enabled=false で空のレスポンス", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ checkinDeadlineTime: null }) as any);

    const res = await GET(makeRequest("http://localhost/api/checkin/calendar?month=2026-06"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.enabled).toBe(false);
    expect(json.logs).toEqual([]);
  });

  it("当月の範囲のみクエリすること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ checkinDeadlineTime: "16:00" }) as any);
    mockPrisma.checkinLog.findMany.mockResolvedValue([] as any);
    mockPrisma.streak.findUnique.mockResolvedValue(streak() as any);

    await GET(makeRequest("http://localhost/api/checkin/calendar?month=2026-06"));

    expect(mockPrisma.checkinLog.findMany).toHaveBeenCalledWith({
      where: {
        childId: "child-1",
        date: {
          gte: new Date("2026-06-01T00:00:00Z"),
          lte: new Date("2026-06-30T00:00:00Z"),
        },
      },
      orderBy: { date: "asc" },
      select: { date: true, success: true },
    });
  });
});
