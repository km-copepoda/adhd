import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { GET } from "@/app/api/parent/checkin/calendar/route";
import { childUser, parentUser, streak } from "../../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

function makeRequest(qs: string): Request {
  return new Request(`http://localhost/api/parent/checkin/calendar?${qs}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-25T03:00:00Z")); // JST 2026-06-25 12:00
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/parent/checkin/calendar", () => {
  it("未認証は 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeRequest("childId=child-1&month=2026-06"));
    expect(res.status).toBe(401);
  });

  it("month 未指定 / 不正は 400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    expect((await GET(makeRequest("childId=child-1"))).status).toBe(400);
    expect((await GET(makeRequest("childId=child-1&month=2026-13"))).status).toBe(400);
    expect((await GET(makeRequest("childId=child-1&month=abc"))).status).toBe(400);
  });

  it("CHILD ロールは 403（resolveTargetChild 経由）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await GET(makeRequest("childId=child-1&month=2026-06"));
    expect(res.status).toBe(403);
  });

  it("childId 未指定は 400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await GET(makeRequest("month=2026-06"));
    expect(res.status).toBe(400);
  });

  it("他 family の子は 404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await GET(makeRequest("childId=other-family-child&month=2026-06"));
    expect(res.status).toBe(404);
  });

  it("checkinDeadlineTime 未設定なら enabled=false", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", checkinDeadlineTime: null }) as any,
    );
    const res = await GET(makeRequest("childId=child-1&month=2026-06"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.enabled).toBe(false);
    expect(json.enabledSince).toBeNull();
  });

  it("月内ログ + enabledSince + ストリークを返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", checkinDeadlineTime: "16:00" }) as any,
    );
    mockPrisma.checkinLog.findMany.mockResolvedValue([
      { date: new Date("2026-06-10T00:00:00Z"), success: true },
      { date: new Date("2026-06-11T00:00:00Z"), success: false },
    ] as any);
    mockPrisma.checkinLog.findFirst.mockResolvedValue({
      date: new Date("2026-06-05T00:00:00Z"),
    } as any);
    mockPrisma.streak.findUnique.mockResolvedValue(
      streak({ checkinCurrentStreak: 3, checkinBestStreak: 7 }) as any,
    );

    const res = await GET(makeRequest("childId=child-1&month=2026-06"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.enabled).toBe(true);
    expect(json.year).toBe(2026);
    expect(json.month).toBe(6);
    expect(json.deadline).toBe("16:00");
    expect(json.logs).toEqual([
      { date: "2026-06-10", success: true },
      { date: "2026-06-11", success: false },
    ]);
    expect(json.enabledSince).toBe("2026-06-05");
    expect(json.currentStreak).toBe(3);
    expect(json.bestStreak).toBe(7);
  });

  it("月内 1〜末日の範囲のみクエリすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", checkinDeadlineTime: "16:00" }) as any,
    );
    mockPrisma.checkinLog.findMany.mockResolvedValue([] as any);
    mockPrisma.checkinLog.findFirst.mockResolvedValue(null);
    mockPrisma.streak.findUnique.mockResolvedValue(streak() as any);

    await GET(makeRequest("childId=child-1&month=2026-06"));

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

  it("ログが 1 件もない子供は enabledSince=今日 (過去全部を empty にする)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", checkinDeadlineTime: "16:00" }) as any,
    );
    mockPrisma.checkinLog.findMany.mockResolvedValue([] as any);
    mockPrisma.checkinLog.findFirst.mockResolvedValue(null);
    mockPrisma.streak.findUnique.mockResolvedValue(streak() as any);

    const res = await GET(makeRequest("childId=child-1&month=2026-06"));
    const json = await res.json();

    expect(json.enabledSince).toBe("2026-06-25");
  });
});
