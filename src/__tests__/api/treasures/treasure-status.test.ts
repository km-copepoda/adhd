import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/treasures/status/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { childUser, parentUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

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
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("opened 履歴は openedAt が直近7日以内のみを問い合わせる", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.treasureLog.count
      .mockResolvedValueOnce(0) // locked
      .mockResolvedValueOnce(0); // unlocked
    mockPrisma.treasureLog.findMany.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);

    const findManyCall = (mockPrisma.treasureLog.findMany as any).mock.calls[0][0];
    // OPENED 状態 + 7日以内のフィルタ
    expect(findManyCall.where.status).toBe("OPENED");
    expect(findManyCall.where.openedAt).toBeDefined();
    expect(findManyCall.where.openedAt.gte).toBeInstanceOf(Date);
    const cutoff = findManyCall.where.openedAt.gte as Date;
    // 7日前
    expect(cutoff.getTime()).toBe(
      new Date("2026-05-22T10:00:00Z").getTime(),
    );
  });

  it("locked / unlocked カウントと opened を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.treasureLog.count
      .mockResolvedValueOnce(2) // locked
      .mockResolvedValueOnce(1); // unlocked
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      {
        id: "log1",
        openedAt: new Date("2026-05-29T09:30:00Z"),
        boosted: false,
        item: { id: "i1", title: "おやつ", rarity: "COMMON" },
      },
    ] as any);

    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.locked).toBe(2);
    expect(json.unlocked).toBe(1);
    expect(json.opened).toHaveLength(1);
    expect(json.opened[0].id).toBe("log1");
  });
});
