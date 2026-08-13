import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { GET } from "@/app/api/parent/child-view/treasures/status/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, childUser, treasureLog } from "../../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

type OpenedTreasureLog = Prisma.TreasureLogGetPayload<{
  include: { item: { select: { id: true; title: true; rarity: true } } };
}>;

const FIXED_NOW = new Date("2026-05-29T10:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function makeReq(childId?: string) {
  const url = childId !== undefined
    ? `http://localhost/api/parent/child-view/treasures/status?childId=${childId}`
    : "http://localhost/api/parent/child-view/treasures/status";
  return new Request(url);
}

describe("GET /api/parent/child-view/treasures/status", () => {
  it("未認証の場合、401 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(401);
  });

  it("CHILD ロールの場合、403 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(403);
  });

  it("childId 未指定の場合、400 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await GET(makeReq(""));
    expect(res.status).toBe(400);
  });

  it("別 family の子を指定された場合、404 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq("child-other"));
    expect(res.status).toBe(404);
  });

  it("opened 履歴は openedAt が直近7日以内のみを問い合わせる", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.treasureLog.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureItem.count.mockResolvedValue(0);

    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(200);

    const findManyCall = mockPrisma.treasureLog.findMany.mock.calls[0][0];
    const where = findManyCall?.where as { status?: unknown; childId?: unknown; openedAt?: { gte?: Date } };
    expect(where.status).toBe("OPENED");
    expect(where.openedAt?.gte).toBeInstanceOf(Date);
    const cutoff = where.openedAt?.gte as Date;
    expect(cutoff.getTime()).toBe(new Date("2026-05-22T10:00:00Z").getTime());
    expect(where.childId).toBe("child-1");
  });

  it("locked / unlocked カウントと opened を子供の childId で問い合わせて返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.treasureLog.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    const opened: OpenedTreasureLog[] = [
      {
        ...treasureLog({
          id: "log1",
          openedAt: new Date("2026-05-29T09:30:00Z"),
          boosted: false,
          status: "OPENED",
          itemId: "i1",
        }),
        item: { id: "i1", title: "おやつ", rarity: "COMMON" },
      },
    ];
    mockPrisma.treasureLog.findMany.mockResolvedValue(opened);
    mockPrisma.treasureItem.count.mockResolvedValue(3);

    const res = await GET(makeReq("child-1"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.locked).toBe(2);
    expect(json.unlocked).toBe(1);
    expect(json.opened).toHaveLength(1);
    expect(json.opened[0].id).toBe("log1");
    expect(json.hasPool).toBe(true);

    // 全ての count / findMany 呼び出しが childId="child-1" で行われていることを確認
    const countCalls = mockPrisma.treasureLog.count.mock.calls;
    countCalls.forEach((args) => {
      expect((args[0]?.where as { childId?: unknown } | undefined)?.childId).toBe("child-1");
    });
    const itemCountCall = mockPrisma.treasureItem.count.mock.calls[0][0];
    expect((itemCountCall?.where as { childId?: unknown } | undefined)?.childId).toBe("child-1");
  });

  it("treasureItem が 0件なら hasPool=false", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.treasureLog.count.mockResolvedValue(0);
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureItem.count.mockResolvedValue(0);

    const res = await GET(makeReq("child-1"));
    const json = await res.json();
    expect(json.hasPool).toBe(false);
  });
});
