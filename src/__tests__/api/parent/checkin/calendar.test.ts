import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCurrentUser } from "@/lib/auth";
import { GET } from "@/app/api/parent/checkin/calendar/route";
import { prismaMock as mockPrisma } from "../../../helpers/prisma-mock";
import { childUserWithFamily, parentUserWithFamily, childUser, streak, checkinLog } from "../../../helpers/fixtures";

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
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    expect((await GET(makeRequest("childId=child-1"))).status).toBe(400);
    expect((await GET(makeRequest("childId=child-1&month=2026-13"))).status).toBe(400);
    expect((await GET(makeRequest("childId=child-1&month=abc"))).status).toBe(400);
  });

  it("CHILD ロールは 403（resolveTargetChild 経由）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await GET(makeRequest("childId=child-1&month=2026-06"));
    expect(res.status).toBe(403);
  });

  it("childId 未指定は 400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await GET(makeRequest("month=2026-06"));
    expect(res.status).toBe(400);
  });

  it("他 family の子は 404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await GET(makeRequest("childId=other-family-child&month=2026-06"));
    expect(res.status).toBe(404);
  });

  it("checkinDeadlineTime 未設定なら enabled=false", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", checkinDeadlineTime: null }),
    );
    const res = await GET(makeRequest("childId=child-1&month=2026-06"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.enabled).toBe(false);
    expect(json.enabledSince).toBeNull();
  });

  it("月内ログ + enabledSince + ストリークを返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", checkinDeadlineTime: "16:00" }),
    );
    // `select: { date, success }` クエリでも mockResolvedValue はベースの CheckinLog 完全型を
    // 要求するため、checkinLog フィクスチャで完全な値を用意する。
    mockPrisma.checkinLog.findMany.mockResolvedValue([
      checkinLog({ date: new Date("2026-06-10T00:00:00Z"), success: true }),
      checkinLog({ date: new Date("2026-06-11T00:00:00Z"), success: false }),
    ]);
    mockPrisma.checkinLog.findFirst.mockResolvedValue(
      checkinLog({ date: new Date("2026-06-05T00:00:00Z") }),
    );
    mockPrisma.streak.findUnique.mockResolvedValue(
      streak({ checkinCurrentStreak: 3, checkinBestStreak: 7 }),
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
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", checkinDeadlineTime: "16:00" }),
    );
    mockPrisma.checkinLog.findMany.mockResolvedValue([]);
    mockPrisma.checkinLog.findFirst.mockResolvedValue(null);
    mockPrisma.streak.findUnique.mockResolvedValue(streak());

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
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", checkinDeadlineTime: "16:00" }),
    );
    mockPrisma.checkinLog.findMany.mockResolvedValue([]);
    mockPrisma.checkinLog.findFirst.mockResolvedValue(null);
    mockPrisma.streak.findUnique.mockResolvedValue(streak());

    const res = await GET(makeRequest("childId=child-1&month=2026-06"));
    const json = await res.json();

    expect(json.enabledSince).toBe("2026-06-25");
  });
});
