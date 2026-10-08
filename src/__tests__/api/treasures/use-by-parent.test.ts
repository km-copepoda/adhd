// #164: 親が承認なしで直接ごほうびを「使用済み」にする専用ルート。
//
// POST /api/treasures/use/[id]
//
// PARENT 専用。UNUSED | USE_REQUESTED -> USED。子への Push は送らない。
// fulfill/[id]（USED の巻き戻し専用）とは別ルート。

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/treasures/use/[id]/route";
import { getCurrentUser } from "@/lib/auth";
import { sendPushToChild, sendPushToParent } from "@/lib/push";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { childUserWithFamily, parentUserWithFamily, treasureLog } from "../../helpers/fixtures";
import { makeParams, makeRequest } from "../../helpers/request";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

const FIXED_NOW = new Date("2026-05-29T10:00:00Z");
const RECENT_OPENED_AT = new Date("2026-05-20T10:00:00Z"); // 9日前 = 期間内

const call = () => POST(makeRequest("/api/treasures/use/t1", {}), makeParams("t1"));

function openedLog(overrides: Parameters<typeof treasureLog>[0] = {}) {
  return treasureLog({
    id: "t1",
    itemId: "item-1",
    status: "OPENED",
    useStatus: "UNUSED",
    openedAt: RECENT_OPENED_AT,
    fulfilled: false,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/treasures/use/[id] — 認証・認可", () => {
  it("未認証で 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(401);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it("子ロールは 403", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await call();
    expect(res.status).toBe(403);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it("PARENT でも familyId なしは 403", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    const res = await call();
    expect(res.status).toBe(403);
  });

  it("他家庭の TreasureLog は 404（where は family スコープ）", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();

    const where = mockPrisma.treasureLog.findFirst.mock.calls[0][0]?.where as {
      id?: unknown;
      child?: { familyId?: unknown };
    };
    expect(where.id).toBe("t1");
    expect(where.child?.familyId).toBe("fam-1");
  });
});

describe("POST /api/treasures/use/[id] — バリデーション（400）", () => {
  it("コレクション当選行（itemId=null）は 400", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      openedLog({ itemId: null, collectionItemId: "summer-01" }),
    );
    const res = await call();
    expect(res.status).toBe(400);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it.each(["LOCKED", "UNLOCKED", "CANCELLED"] as const)(
    "status が %s の行は 400（OPENED 以外は使えない）",
    async (status) => {
      mockPrisma.treasureLog.findFirst.mockResolvedValue(
        openedLog({ status, openedAt: status === "LOCKED" ? null : RECENT_OPENED_AT }),
      );
      const res = await call();
      expect(res.status).toBe(400);
      expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
    },
  );

  it("保持期間外（31日前に開封）の行は 400", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      openedLog({ openedAt: new Date("2026-04-28T10:00:00Z") }),
    );
    const res = await call();
    expect(res.status).toBe(400);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it("ちょうど30日前の開封は許可（境界値・inclusive）", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      openedLog({ openedAt: new Date("2026-04-29T10:00:00Z") }),
    );
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });
    const res = await call();
    expect(res.status).toBe(200);
  });

  it("30日前より1ミリ秒古い開封は 400（境界値）", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      openedLog({ openedAt: new Date("2026-04-29T09:59:59.999Z") }),
    );
    const res = await call();
    expect(res.status).toBe(400);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it("既に USED の行は更新前に 400", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      openedLog({ useStatus: "USED", fulfilled: true, useApprovedAt: RECENT_OPENED_AT }),
    );
    const res = await call();
    expect(res.status).toBe(400);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it("初回読取が UNUSED でも updateMany.count=0（レース負け）なら 400", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(openedLog({ useStatus: "UNUSED" }));
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 0 });
    const res = await call();
    expect(res.status).toBe(400);
  });

  it("初回読取が USE_REQUESTED でも updateMany.count=0（承認センター/cron に負けた）なら 400", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      openedLog({ useStatus: "USE_REQUESTED", useRequestedAt: RECENT_OPENED_AT }),
    );
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 0 });
    const res = await call();
    expect(res.status).toBe(400);
  });
});

describe("POST /api/treasures/use/[id] — 正常系", () => {
  it("UNUSED 起点: 200 で USED / fulfilled=true を返す", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(openedLog({ useStatus: "UNUSED" }));
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });

    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: "t1", useStatus: "USED", fulfilled: true });
  });

  it("USE_REQUESTED 起点: 200 で USED / fulfilled=true を返す", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      openedLog({ useStatus: "USE_REQUESTED", useRequestedAt: RECENT_OPENED_AT }),
    );
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });

    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, id: "t1", useStatus: "USED", fulfilled: true });
  });

  it("updateMany の where は UNUSED/USE_REQUESTED のみ許可し、data に useRequestedAt を含めない", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(openedLog());
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });

    await call();

    const arg = mockPrisma.treasureLog.updateMany.mock.calls[0][0] as unknown as {
      where: { id: string; useStatus: { in: string[] } };
      data: Record<string, unknown>;
    };
    expect(arg.where.id).toBe("t1");
    expect([...arg.where.useStatus.in].sort()).toEqual(["UNUSED", "USE_REQUESTED"]);
    expect(arg.data).toMatchObject({ useStatus: "USED", fulfilled: true });
    expect(Object.keys(arg.data)).not.toContain("useRequestedAt");
  });

  it("子/親への Push は一切送らない", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(openedLog());
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });

    await call();

    expect(vi.mocked(sendPushToParent)).not.toHaveBeenCalled();
    expect(vi.mocked(sendPushToChild)).not.toHaveBeenCalled();
  });

  it("XP/成長には触れない（user.update を呼ばない）", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(openedLog());
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });

    await call();

    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
