// #151: 子が「ごほうびを使う」申請を出す専用ルート（親承認フローの起点）。
//
// POST /api/child/treasures/use-request/[id]
//
// 子専用。UNUSED -> USE_REQUESTED のみを許可する。
// 旧 POST /api/child/treasures/fulfill/[id]（子がトグルできた旧仕様）はファイルごと削除される。
// 子から USE_REQUESTED / USED を巻き戻す API は存在しない（キャンセル不可）。

import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/child/treasures/use-request/[id]/route";
import { getCurrentUser } from "@/lib/auth";
import { sendPushToParent } from "@/lib/push";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { childUserWithFamily, parentUser, parentUserWithFamily, treasureLog } from "../../helpers/fixtures";
import { makeParams, makeRequest } from "../../helpers/request";

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockSendPushToParent = vi.mocked(sendPushToParent);

// FIXED_NOW を基準に「保持期間（30日）内の開封」を表す openedAt
const FIXED_NOW = new Date("2026-05-29T10:00:00Z");
const RECENT_OPENED_AT = new Date("2026-05-20T10:00:00Z"); // 9日前 = 期間内

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
  mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/child/treasures/use-request/[id]", () => {
  it("未認証で 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/child/treasures/use-request/t1", {}), makeParams("t1"));
    expect(res.status).toBe(401);
  });

  it("PARENT ロールで 403（子専用ルート）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await POST(makeRequest("/api/child/treasures/use-request/t1", {}), makeParams("t1"));
    expect(res.status).toBe(403);
  });

  it("他人（別 child）の TreasureLog は 404（where は自分の childId にスコープ）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(null);
    const res = await POST(makeRequest("/api/child/treasures/use-request/t-other", {}), makeParams("t-other"));
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
    const res = await POST(makeRequest("/api/child/treasures/use-request/t1", {}), makeParams("t1"));
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
        useStatus: "UNUSED",
        openedAt: RECENT_OPENED_AT,
        fulfilled: false,
      }),
    );
    const res = await POST(makeRequest("/api/child/treasures/use-request/t-col", {}), makeParams("t-col"));
    expect(res.status).toBe(400);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it.each(["LOCKED", "UNLOCKED", "CANCELLED"] as const)(
    "status が %s の行は 400（OPENED 以外は申請できない）",
    async (status) => {
      mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
      mockPrisma.treasureLog.findFirst.mockResolvedValue(
        treasureLog({
          id: "t1",
          itemId: "item-1",
          status,
          useStatus: "UNUSED",
          openedAt: status === "LOCKED" ? null : RECENT_OPENED_AT,
          fulfilled: false,
        }),
      );
      const res = await POST(makeRequest("/api/child/treasures/use-request/t1", {}), makeParams("t1"));
      expect(res.status).toBe(400);
      expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
    },
  );

  it("保持期間外（31日前に開封）の行は 400（API 直叩き防御）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t-old",
        itemId: "item-1",
        status: "OPENED",
        useStatus: "UNUSED",
        openedAt: new Date("2026-04-28T10:00:00Z"), // 31日前
        fulfilled: false,
      }),
    );
    const res = await POST(makeRequest("/api/child/treasures/use-request/t-old", {}), makeParams("t-old"));
    expect(res.status).toBe(400);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it("保持期間ちょうど30日前の開封は許可（境界値・inclusive）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t-30d",
        itemId: "item-1",
        status: "OPENED",
        useStatus: "UNUSED",
        openedAt: new Date("2026-04-29T10:00:00Z"), // ちょうど30日前
        fulfilled: false,
      }),
    );
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });
    const res = await POST(makeRequest("/api/child/treasures/use-request/t-30d", {}), makeParams("t-30d"));
    expect(res.status).toBe(200);
  });

  it("30日前より1ミリ秒古い開封は 400（境界値）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t-1ms",
        itemId: "item-1",
        status: "OPENED",
        useStatus: "UNUSED",
        openedAt: new Date("2026-04-29T09:59:59.999Z"),
        fulfilled: false,
      }),
    );
    const res = await POST(makeRequest("/api/child/treasures/use-request/t-1ms", {}), makeParams("t-1ms"));
    expect(res.status).toBe(400);
  });

  it("既に USE_REQUESTED の行への申請は 400（二重申請拒否）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t1",
        itemId: "item-1",
        status: "OPENED",
        useStatus: "USE_REQUESTED",
        useRequestedAt: RECENT_OPENED_AT,
        openedAt: RECENT_OPENED_AT,
        fulfilled: false,
      }),
    );
    const res = await POST(makeRequest("/api/child/treasures/use-request/t1", {}), makeParams("t1"));
    expect(res.status).toBe(400);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it("既に USED の行への申請は 400（使用済みへの再申請拒否）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t1",
        itemId: "item-1",
        status: "OPENED",
        useStatus: "USED",
        useApprovedAt: RECENT_OPENED_AT,
        openedAt: RECENT_OPENED_AT,
        fulfilled: true,
      }),
    );
    const res = await POST(makeRequest("/api/child/treasures/use-request/t1", {}), makeParams("t1"));
    expect(res.status).toBe(400);
    expect(mockPrisma.treasureLog.updateMany).not.toHaveBeenCalled();
  });

  it("正常系: useStatus が USE_REQUESTED になり fulfilled は false のまま", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t1",
        itemId: "item-1",
        status: "OPENED",
        useStatus: "UNUSED",
        openedAt: RECENT_OPENED_AT,
        fulfilled: false,
      }),
    );
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makeRequest("/api/child/treasures/use-request/t1", {}), makeParams("t1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.useStatus).toBe("USE_REQUESTED");
    expect(json.fulfilled).toBe(false);
  });

  it("useRequestedAt が現在時刻で設定される", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t1",
        itemId: "item-1",
        status: "OPENED",
        useStatus: "UNUSED",
        openedAt: RECENT_OPENED_AT,
        fulfilled: false,
      }),
    );
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });

    await POST(makeRequest("/api/child/treasures/use-request/t1", {}), makeParams("t1"));

    const call = mockPrisma.treasureLog.updateMany.mock.calls[0][0];
    expect(call?.data).toMatchObject({
      useStatus: "USE_REQUESTED",
      useRequestedAt: FIXED_NOW,
    });
  });

  it("条件付き updateMany（TOCTOU 対策）: where に現在の useStatus (UNUSED) を含める", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t1",
        itemId: "item-1",
        status: "OPENED",
        useStatus: "UNUSED",
        openedAt: RECENT_OPENED_AT,
        fulfilled: false,
      }),
    );
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });

    await POST(makeRequest("/api/child/treasures/use-request/t1", {}), makeParams("t1"));

    const call = mockPrisma.treasureLog.updateMany.mock.calls[0][0];
    const where = call?.where as { id?: unknown; useStatus?: unknown };
    expect(where.id).toBe("t1");
    expect(where.useStatus).toBe("UNUSED");
  });

  it("updateMany の count が 0（レース負け）なら 400 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t1",
        itemId: "item-1",
        status: "OPENED",
        useStatus: "UNUSED",
        openedAt: RECENT_OPENED_AT,
        fulfilled: false,
      }),
    );
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(makeRequest("/api/child/treasures/use-request/t1", {}), makeParams("t1"));
    expect(res.status).toBe(400);
  });

  it("親へ sendPushToParent が1回呼ばれる", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ name: "太郎" }));
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t1",
        itemId: "item-1",
        status: "OPENED",
        useStatus: "UNUSED",
        openedAt: RECENT_OPENED_AT,
        fulfilled: false,
      }),
    );
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" }));

    await POST(makeRequest("/api/child/treasures/use-request/t1", {}), makeParams("t1"));

    expect(mockSendPushToParent).toHaveBeenCalledTimes(1);
    expect(mockSendPushToParent).toHaveBeenCalledWith(
      "parent-1",
      expect.objectContaining({
        title: expect.any(String),
        body: expect.any(String),
      }),
    );
  });

  it("プッシュ送信が失敗しても申請自体は成功する", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.treasureLog.findFirst.mockResolvedValue(
      treasureLog({
        id: "t1",
        itemId: "item-1",
        status: "OPENED",
        useStatus: "UNUSED",
        openedAt: RECENT_OPENED_AT,
        fulfilled: false,
      }),
    );
    mockPrisma.treasureLog.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" }));
    mockSendPushToParent.mockRejectedValue(new Error("push failed"));

    const res = await POST(makeRequest("/api/child/treasures/use-request/t1", {}), makeParams("t1"));
    expect(res.status).toBe(200);
  });
});

describe("旧仕様の廃止（#151）", () => {
  it("旧ルート POST /api/child/treasures/fulfill/[id] はファイルごと削除されている", () => {
    const routePath = path.join(
      process.cwd(),
      "src/app/api/child/treasures/fulfill/[id]/route.ts",
    );
    expect(fs.existsSync(routePath)).toBe(false);
  });

  it("子が USE_REQUESTED / USED を巻き戻す API は存在しない（キャンセル不可）", () => {
    const childTreasuresDir = path.join(process.cwd(), "src/app/api/child/treasures");
    const entries = fs.readdirSync(childTreasuresDir);
    // 子専用ディレクトリには申請用の use-request のみが存在し、
    // fulfill / cancel / revoke 等の巻き戻し系ルートが無いこと
    expect(entries).toEqual(["use-request"]);
  });
});
