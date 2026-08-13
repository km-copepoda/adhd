import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { GET } from "@/app/api/treasures/status/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { childUserWithFamily, parentUserWithFamily, treasureLog } from "../../helpers/fixtures";

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

describe("GET /api/treasures/status", () => {
  it("未認証で403", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("PARENT で403（CHILD 専用 API）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("opened 履歴は openedAt が直近7日以内のみを問い合わせる", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.count
      .mockResolvedValueOnce(0) // locked
      .mockResolvedValueOnce(0); // unlocked
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureItem.count.mockResolvedValue(0);

    const res = await GET();
    expect(res.status).toBe(200);

    const findManyCall = mockPrisma.treasureLog.findMany.mock.calls[0][0];
    const where = findManyCall?.where as { status?: unknown; openedAt?: { gte?: Date } };
    // OPENED 状態 + 7日以内のフィルタ
    expect(where.status).toBe("OPENED");
    expect(where.openedAt).toBeDefined();
    expect(where.openedAt?.gte).toBeInstanceOf(Date);
    const cutoff = where.openedAt?.gte as Date;
    // 7日前
    expect(cutoff.getTime()).toBe(
      new Date("2026-05-22T10:00:00Z").getTime(),
    );
  });

  it("locked / unlocked カウントと opened を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.count
      .mockResolvedValueOnce(2) // locked
      .mockResolvedValueOnce(1); // unlocked
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
    mockPrisma.treasureItem.count.mockResolvedValue(0);

    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.locked).toBe(2);
    expect(json.unlocked).toBe(1);
    expect(json.opened).toHaveLength(1);
    expect(json.opened[0].id).toBe("log1");
  });

  it("treasureItem (有効プール) が 1件以上あれば hasPool=true", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.count.mockResolvedValue(0);
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureItem.count.mockResolvedValue(3);

    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.hasPool).toBe(true);
  });

  it("treasureItem が 0件なら hasPool=false (フッタータブ非表示判定に使う)", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.count.mockResolvedValue(0);
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);
    mockPrisma.treasureItem.count.mockResolvedValue(0);

    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.hasPool).toBe(false);
  });
});
