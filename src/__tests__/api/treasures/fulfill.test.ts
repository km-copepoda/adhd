// #151: ごほうび使用を親承認フロー化する — このルートは「承認済み(USED)の巻き戻し専用」に一本化。
//
// POST /api/treasures/fulfill/[id]
//
// 旧仕様（fulfilled を任意の boolean にトグルできた）は廃止。
// USED -> UNUSED の巻き戻しのみを許可する（PARENT only）。
// USE_REQUESTED や UNUSED からの巻き戻しは 400（承認/却下は /api/approve/[id] 側の責務）。

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/treasures/fulfill/[id]/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { childUserWithFamily, parentUserWithFamily, treasureLog } from "../../helpers/fixtures";
import { makeParams, makeRequest } from "../../helpers/request";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

// #171: 保持期間(30日)判定のため現在時刻を固定する
const FIXED_NOW = new Date("2026-05-29T10:00:00Z");
const RECENT_OPENED_AT = new Date("2026-05-20T10:00:00Z"); // 9日前 = 期間内
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/treasures/fulfill/[id]（承認済みの巻き戻し専用・#151）", () => {
  it("未認証で 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/treasures/fulfill/t1", {}), makeParams("t1"));
    expect(res.status).toBe(401);
  });

  it("CHILD ロールで 403 (親のみ操作可)", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await POST(makeRequest("/api/treasures/fulfill/t1", {}), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("対象 TreasureLog が無ければ 404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/treasures/fulfill/t-missing", {}), makeParams("t-missing"));
    expect(res.status).toBe(404);
  });

  it("別 family の TreasureLog で 404 (familyId スコープ)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-1" }));
    mockPrisma.treasureLog.findFirst.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/treasures/fulfill/t1", {}), makeParams("t1"));
    expect(res.status).toBe(404);
    const callArg = mockPrisma.treasureLog.findFirst.mock.calls[0][0];
    const where = callArg?.where as { child?: { familyId?: unknown } };
    expect(where.child?.familyId).toBe("fam-1");
  });

  it("コレクション獲得 (itemId=null) は 400 (実物受け渡しが無いので概念なし)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-1" }));
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t-col",
        itemId: null,
        collectionItemId: "summer-01",
        useStatus: "UNUSED",
        fulfilled: false,
      }),
    );

    const res = await POST(makeRequest("/api/treasures/fulfill/t-col", {}), makeParams("t-col"));
    expect(res.status).toBe(400);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it("USED を UNUSED に巻き戻せる（正常系）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-1" }));
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t1",
        itemId: "item-1",
        openedAt: RECENT_OPENED_AT,
        useStatus: "USED",
        useRequestedAt: new Date("2026-05-20T10:00:00Z"),
        useApprovedAt: new Date("2026-05-21T10:00:00Z"),
        fulfilled: true,
      }),
    );
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeRequest("/api/treasures/fulfill/t1", {}), makeParams("t1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.useStatus).toBe("UNUSED");
    expect(json.fulfilled).toBe(false);
  });

  it("巻き戻し後に useRequestedAt / useApprovedAt が両方クリアされる（再申請可能にするため）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-1" }));
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t1",
        itemId: "item-1",
        openedAt: RECENT_OPENED_AT,
        useStatus: "USED",
        useRequestedAt: new Date("2026-05-20T10:00:00Z"),
        useApprovedAt: new Date("2026-05-21T10:00:00Z"),
        fulfilled: true,
      }),
    );
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });

    await POST(makeRequest("/api/treasures/fulfill/t1", {}), makeParams("t1"));

    const call = mockPrisma.treasureLog.updateMany.mock.calls[0][0];
    expect(call?.data).toMatchObject({
      useStatus: "UNUSED",
      useRequestedAt: null,
      useApprovedAt: null,
      fulfilled: false,
    });
  });

  it("条件付き updateMany: where に現在の useStatus (USED) を含める（TOCTOU 対策）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-1" }));
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({ id: "t1", itemId: "item-1",
        openedAt: RECENT_OPENED_AT, useStatus: "USED", fulfilled: true }),
    );
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });

    await POST(makeRequest("/api/treasures/fulfill/t1", {}), makeParams("t1"));

    const call = mockPrisma.treasureLog.updateMany.mock.calls[0][0];
    const where = call?.where as { id?: unknown; useStatus?: unknown };
    expect(where.id).toBe("t1");
    expect(where.useStatus).toBe("USED");
  });

  it("USE_REQUESTED への巻き戻しは 400（承認待ちは approve/[id] の責務）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-1" }));
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({ id: "t1", itemId: "item-1",
        openedAt: RECENT_OPENED_AT, useStatus: "USE_REQUESTED", fulfilled: false }),
    );

    const res = await POST(makeRequest("/api/treasures/fulfill/t1", {}), makeParams("t1"));
    expect(res.status).toBe(400);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it("UNUSED への巻き戻しは 400（既に未使用）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-1" }));
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({ id: "t1", itemId: "item-1",
        openedAt: RECENT_OPENED_AT, useStatus: "UNUSED", fulfilled: false }),
    );

    const res = await POST(makeRequest("/api/treasures/fulfill/t1", {}), makeParams("t1"));
    expect(res.status).toBe(400);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it("updateMany の count が 0（レース負け）なら 400 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-1" }));
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({ id: "t1", itemId: "item-1",
        openedAt: RECENT_OPENED_AT, useStatus: "USED", fulfilled: true }),
    );
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(makeRequest("/api/treasures/fulfill/t1", {}), makeParams("t1"));
    expect(res.status).toBe(400);
  });
});

// ─── #171: 保持期間(30日)外のごほうびは取り消せない ─────────────
describe("POST /api/treasures/fulfill/[id] — 保持期間外は取り消せない（#171）", () => {
  const call = () => POST(makeRequest("/api/treasures/fulfill/t1", {}), makeParams("t1"));

  function usedLog(overrides: Parameters<typeof treasureLog>[0] = {}) {
    return treasureLog({
      id: "t1",
      itemId: "item-1",
      status: "OPENED",
      useStatus: "USED",
      fulfilled: true,
      openedAt: RECENT_OPENED_AT,
      ...overrides,
    });
  }

  beforeEach(() => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-1" }));
  });

  it("findFirst の select に openedAt を含める", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(usedLog());
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });
    await call();
    const arg = mockPrisma.treasureLog.findFirst.mock.calls[0][0];
    const select = arg?.select as { openedAt?: unknown };
    expect(select.openedAt).toBe(true);
  });

  it("ちょうど30日前に開封したものは取り消せる (200・境界 inclusive)", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      usedLog({ openedAt: new Date(FIXED_NOW.getTime() - THIRTY_DAYS_MS) }),
    );
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });
    const res = await call();
    expect(res.status).toBe(200);
    expect(mockPrisma.treasureLog.updateMany).toHaveBeenCalledTimes(1);
  });

  it("30日より1ms古いと 400 で updateMany は呼ばれない", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      usedLog({ openedAt: new Date(FIXED_NOW.getTime() - THIRTY_DAYS_MS - 1) }),
    );
    const res = await call();
    expect(res.status).toBe(400);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it("openedAt が null の USED は 400 で updateMany は呼ばれない", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(usedLog({ openedAt: null }));
    const res = await call();
    expect(res.status).toBe(400);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it("チェック順: itemId:null + openedAt:null はコレクション用エラー（保持期間エラーではない）", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({ id: "t1", itemId: null, collectionItemId: "summer-01", openedAt: null }),
    );
    const res = await call();
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("コレクション");
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it("チェック順: 期限外 + UNUSED は保持期間エラー（canRevokeUse より先）", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      usedLog({
        useStatus: "UNUSED",
        fulfilled: false,
        openedAt: new Date(FIXED_NOW.getTime() - THIRTY_DAYS_MS - 1),
      }),
    );
    const res = await call();
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("保持期間");
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it("チェック順: 他家庭の期限外データは 404（家庭スコープが先）", async () => {
    mockPrisma.treasureLog.findFirst.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });
});
