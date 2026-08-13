import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as listPOST } from "@/app/api/treasures/route";
import { PUT as itemPUT } from "@/app/api/treasures/[id]/route";
import { POST as importPOST } from "@/app/api/treasures/import/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUser, parentUser, treasureItem, subscription } from "../../helpers/fixtures";
import { makeParams, makeRequest } from "../../helpers/request";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
});

/// FREE プランのごほうび (TreasureItem) 上限 (5個/子) の enforce を担保。
/// 仕様: docs/未実装仕様書/monetization-plan.md §2.6 / §4.4
describe("POST /api/treasures — FREE プランのごほうび上限", () => {
  beforeEach(() => {
    // 家族チェック用
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
  });

  it("FREE で 4/5: 5 個目は追加成功", async () => {
    // getFamilyPlan 用に PARENT を返し (2 回目呼び出し), Subscription なし
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(childUser({ id: "child-1" })) // ensureFamilyChild
      .mockResolvedValueOnce(parentUser({ id: "parent-1" })); // getFamilyPlan
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.treasureItem.count.mockResolvedValue(4);
    mockPrisma.treasureItem.create.mockResolvedValue(
      treasureItem({ id: "i-new", title: "おやつ", rarity: "COMMON", sortOrder: 0, isActive: true }),
    );

    const res = await listPOST(
      makeRequest("/api/treasures", { childId: "child-1", title: "おやつ", rarity: "COMMON" }),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.treasureItem.create).toHaveBeenCalled();
  });

  it("FREE で 5/5: 6 個目は 403 で拒否", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(childUser({ id: "child-1" }))
      .mockResolvedValueOnce(parentUser({ id: "parent-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.treasureItem.count.mockResolvedValue(5);

    const res = await listPOST(
      makeRequest("/api/treasures", { childId: "child-1", title: "6個目", rarity: "COMMON" }),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("PLAN_LIMIT_EXCEEDED");
    expect(json.resource).toBe("treasure_item");
    expect(json.limit).toBe(5);
    expect(json.current).toBe(5);
    expect(mockPrisma.treasureItem.create).not.toHaveBeenCalled();
  });

  it("PREMIUM 有効期間中は無制限に追加可能", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(childUser({ id: "child-1" }))
      .mockResolvedValueOnce(parentUser({ id: "parent-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: new Date("2099-12-31") }),
    );
    mockPrisma.treasureItem.count.mockResolvedValue(999);
    mockPrisma.treasureItem.create.mockResolvedValue(treasureItem({ id: "i-premium" }));

    const res = await listPOST(
      makeRequest("/api/treasures", { childId: "child-1", title: "無制限", rarity: "COMMON" }),
    );
    expect(res.status).toBe(200);
  });

  it("カウントは childId ごと isActive: true のみ", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(childUser({ id: "child-1" }))
      .mockResolvedValueOnce(parentUser({ id: "parent-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.treasureItem.count.mockResolvedValue(0);
    mockPrisma.treasureItem.create.mockResolvedValue(treasureItem({ id: "i1" }));

    await listPOST(
      makeRequest("/api/treasures", { childId: "child-1", title: "x", rarity: "COMMON" }),
    );

    expect(mockPrisma.treasureItem.count).toHaveBeenCalledWith({
      where: { childId: "child-1", isActive: true },
    });
  });
});

describe("PUT /api/treasures/[id] — 再アクティブ化時の上限チェック", () => {
  it("isActive: false → true (再アクティブ化) は上限チェックが走る (FREE 5/5 で 403)", async () => {
    mockPrisma.treasureItem.findFirst.mockResolvedValue(
      treasureItem({ id: "i1", childId: "child-1", isActive: false }),
    );
    mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(null); // FREE
    mockPrisma.treasureItem.count.mockResolvedValue(5);

    const res = await itemPUT(
      makeRequest("/api/treasures/i1", { isActive: true }),
      makeParams("i1"),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("PLAN_LIMIT_EXCEEDED");
    expect(mockPrisma.treasureItem.update).not.toHaveBeenCalled();
  });

  it("isActive: false → true が FREE 4/5 なら成功", async () => {
    mockPrisma.treasureItem.findFirst.mockResolvedValue(
      treasureItem({ id: "i1", childId: "child-1", isActive: false }),
    );
    mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.treasureItem.count.mockResolvedValue(4);
    mockPrisma.treasureItem.update.mockResolvedValue(treasureItem({ id: "i1" }));

    const res = await itemPUT(
      makeRequest("/api/treasures/i1", { isActive: true }),
      makeParams("i1"),
    );
    expect(res.status).toBe(200);
  });

  it("isActive: true → false (非アクティブ化) は上限チェック不要 (常に成功)", async () => {
    mockPrisma.treasureItem.findFirst.mockResolvedValue(
      treasureItem({ id: "i1", childId: "child-1", isActive: true }),
    );
    mockPrisma.treasureItem.update.mockResolvedValue(treasureItem({ id: "i1" }));

    const res = await itemPUT(
      makeRequest("/api/treasures/i1", { isActive: false }),
      makeParams("i1"),
    );
    expect(res.status).toBe(200);
    // 上限チェックは呼ばれない (count 呼び出しなし)
    expect(mockPrisma.treasureItem.count).not.toHaveBeenCalled();
  });

  it("isActive を触らない title/rarity 更新は上限チェック不要", async () => {
    mockPrisma.treasureItem.findFirst.mockResolvedValue(
      treasureItem({ id: "i1", childId: "child-1", isActive: true }),
    );
    mockPrisma.treasureItem.update.mockResolvedValue(treasureItem({ id: "i1" }));

    const res = await itemPUT(
      makeRequest("/api/treasures/i1", { title: "変更", rarity: "RARE" }),
      makeParams("i1"),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.treasureItem.count).not.toHaveBeenCalled();
  });

  it("既に isActive: true な状態で isActive: true を送信 (no-op) は上限チェック不要", async () => {
    mockPrisma.treasureItem.findFirst.mockResolvedValue(
      treasureItem({ id: "i1", childId: "child-1", isActive: true }),
    );
    mockPrisma.treasureItem.update.mockResolvedValue(treasureItem({ id: "i1" }));

    const res = await itemPUT(
      makeRequest("/api/treasures/i1", { isActive: true }),
      makeParams("i1"),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.treasureItem.count).not.toHaveBeenCalled();
  });
});

describe("POST /api/treasures/import — バルクインポートの上限チェック", () => {
  it("FREE + 0 個: 20 個 import は 403 (合計 20 > 上限 5)", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(childUser({ id: "child-1" })) // 対象子供検証
      .mockResolvedValueOnce(parentUser({ id: "parent-1" })); // getFamilyPlan
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.treasureItem.count.mockResolvedValue(0);

    const res = await importPOST(
      makeRequest("/api/treasures/import", { childId: "child-1" }),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("PLAN_LIMIT_EXCEEDED");
    expect(json.resource).toBe("treasure_item");
    expect(mockPrisma.treasureItem.createMany).not.toHaveBeenCalled();
  });

  it("PREMIUM は 20 個 import 成功", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(childUser({ id: "child-1" }))
      .mockResolvedValueOnce(parentUser({ id: "parent-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: new Date("2099-12-31") }),
    );
    mockPrisma.treasureItem.count.mockResolvedValue(0);
    mockPrisma.treasureItem.createMany.mockResolvedValue({ count: 20 });

    const res = await importPOST(
      makeRequest("/api/treasures/import", { childId: "child-1" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(20);
  });
});
