// #72 — 子供が自分のごほうびの「つかった / つかってない」をトグルする子専用ルート。
//
// POST /api/child/treasures/fulfill/[id]  body: { fulfilled: boolean }
//
// 既存の親専用 POST /api/treasures/fulfill/[id]（PARENT only）とは別ルート。
// fulfilled カラムは共有だが、由来は追わない（表示は ✅使用済み / ⏳未使用 の二値）。
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/child/treasures/fulfill/[id]/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../../helpers/prisma-mock";
import { childUserWithFamily, parentUserWithFamily, treasureLog } from "../../../helpers/fixtures";
import { makeParams, makeRequest } from "../../../helpers/request";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

// FIXED_NOW を基準に「保持期間（30日）内の開封」を表す openedAt
const FIXED_NOW = new Date("2026-05-29T10:00:00Z");
const RECENT_OPENED_AT = new Date("2026-05-20T10:00:00Z"); // 9日前 = 期間内

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/child/treasures/fulfill/[id]", () => {
  it("未認証で 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(
      makeRequest("/api/child/treasures/fulfill/t1", { fulfilled: true }),
      makeParams("t1"),
    );
    expect(res.status).toBe(401);
  });

  it("PARENT ロールで 403（子専用ルート）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await POST(
      makeRequest("/api/child/treasures/fulfill/t1", { fulfilled: true }),
      makeParams("t1"),
    );
    expect(res.status).toBe(403);
  });

  it("他人（別 child）の TreasureLog は 404（where は自分の childId にスコープ）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(null);
    const res = await POST(
      makeRequest("/api/child/treasures/fulfill/t-other", { fulfilled: true }),
      makeParams("t-other"),
    );
    expect(res.status).toBe(404);

    const where = mockPrisma.treasureLog.findFirst.mock.calls[0][0]?.where as {
      id?: unknown;
      childId?: unknown;
    };
    expect(where.id).toBe("t-other");
    expect(where.childId).toBe("child-1");
  });

  it("別家庭の TreasureLog は 404", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(null);
    const res = await POST(
      makeRequest("/api/child/treasures/fulfill/t1", { fulfilled: true }),
      makeParams("t1"),
    );
    expect(res.status).toBe(404);
  });

  it("コレクション当選行（itemId=null）は 400", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t-col",
        itemId: null,
        collectionItemId: "summer-01",
        status: "OPENED",
        openedAt: RECENT_OPENED_AT,
        fulfilled: false,
      }),
    );
    const res = await POST(
      makeRequest("/api/child/treasures/fulfill/t-col", { fulfilled: true }),
      makeParams("t-col"),
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.treasureLog.update).not.toHaveBeenCalled();
  });

  it.each(["LOCKED", "UNLOCKED", "CANCELLED"] as const)(
    "status が %s の行は 400（OPENED 以外は使用状態の概念なし）",
    async (status) => {
      mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
      mockPrisma.treasureLog.findFirst.mockResolvedValue(
        treasureLog({
          id: "t1",
          itemId: "item-1",
          status,
          openedAt: status === "LOCKED" ? null : RECENT_OPENED_AT,
          fulfilled: false,
        }),
      );
      const res = await POST(
        makeRequest("/api/child/treasures/fulfill/t1", { fulfilled: true }),
        makeParams("t1"),
      );
      expect(res.status).toBe(400);
      expect(mockPrisma.treasureLog.update).not.toHaveBeenCalled();
    },
  );

  it("保持期間外（31日前に開封）の行は 400（API 直叩き防御）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t-old",
        itemId: "item-1",
        status: "OPENED",
        openedAt: new Date("2026-04-28T10:00:00Z"), // 31日前
        fulfilled: false,
      }),
    );
    const res = await POST(
      makeRequest("/api/child/treasures/fulfill/t-old", { fulfilled: true }),
      makeParams("t-old"),
    );
    expect(res.status).toBe(400);
    expect(mockPrisma.treasureLog.update).not.toHaveBeenCalled();
  });

  it("保持期間ちょうど30日前の開封は許可（境界値・inclusive）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t-30d",
        itemId: "item-1",
        status: "OPENED",
        openedAt: new Date("2026-04-29T10:00:00Z"), // ちょうど30日前
        fulfilled: false,
      }),
    );
    mockPrisma.treasureLog.update.mockResolvedValue(
      treasureLog({ id: "t-30d", itemId: "item-1", fulfilled: true }),
    );
    const res = await POST(
      makeRequest("/api/child/treasures/fulfill/t-30d", { fulfilled: true }),
      makeParams("t-30d"),
    );
    expect(res.status).toBe(200);
  });

  it("正常系: { fulfilled: true } で fulfilled が true になる", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t1",
        itemId: "item-1",
        status: "OPENED",
        openedAt: RECENT_OPENED_AT,
        fulfilled: false,
      }),
    );
    mockPrisma.treasureLog.update.mockResolvedValue(
      treasureLog({ id: "t1", itemId: "item-1", fulfilled: true }),
    );

    const res = await POST(
      makeRequest("/api/child/treasures/fulfill/t1", { fulfilled: true }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
    const updateArg = mockPrisma.treasureLog.update.mock.calls[0][0];
    expect(updateArg?.data).toMatchObject({ fulfilled: true });
    expect((updateArg?.where as { id?: unknown }).id).toBe("t1");
    const json = await res.json();
    expect(json.fulfilled).toBe(true);
  });

  it("取り消し: { fulfilled: false } で false に戻る", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t1",
        itemId: "item-1",
        status: "OPENED",
        openedAt: RECENT_OPENED_AT,
        fulfilled: true,
      }),
    );
    mockPrisma.treasureLog.update.mockResolvedValue(
      treasureLog({ id: "t1", itemId: "item-1", fulfilled: false }),
    );

    const res = await POST(
      makeRequest("/api/child/treasures/fulfill/t1", { fulfilled: false }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.treasureLog.update.mock.calls[0][0]?.data).toMatchObject({
      fulfilled: false,
    });
  });

  it("body.fulfilled が boolean 以外なら 400", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await POST(
      makeRequest("/api/child/treasures/fulfill/t1", { fulfilled: "yes" }),
      makeParams("t1"),
    );
    expect(res.status).toBe(400);
  });

  it("body が空（fulfilled 未指定）なら 400", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await POST(
      makeRequest("/api/child/treasures/fulfill/t1", {}),
      makeParams("t1"),
    );
    expect(res.status).toBe(400);
  });

  it("同じ値で2回実行しても冪等（200 が返る）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t1",
        itemId: "item-1",
        status: "OPENED",
        openedAt: RECENT_OPENED_AT,
        fulfilled: true,
      }),
    );
    mockPrisma.treasureLog.update.mockResolvedValue(
      treasureLog({ id: "t1", itemId: "item-1", fulfilled: true }),
    );

    const res1 = await POST(
      makeRequest("/api/child/treasures/fulfill/t1", { fulfilled: true }),
      makeParams("t1"),
    );
    const res2 = await POST(
      makeRequest("/api/child/treasures/fulfill/t1", { fulfilled: true }),
      makeParams("t1"),
    );
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
  });
});
