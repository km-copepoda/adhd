import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as listGET, POST as listPOST } from "@/app/api/treasures/route";
import { PUT as itemPUT, DELETE as itemDELETE } from "@/app/api/treasures/[id]/route";
import { POST as importPOST } from "@/app/api/treasures/import/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, childUser, parentUser, treasureItem, subscription } from "../../helpers/fixtures";
import { makeParams, makeRequest } from "../../helpers/request";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /api/treasures ──────────────────────────────────────────────
describe("GET /api/treasures", () => {
  it("未認証で403", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await listGET(new Request("http://localhost/api/treasures?childId=c1"));
    expect(res.status).toBe(403);
  });

  it("CHILDロールで403", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await listGET(new Request("http://localhost/api/treasures?childId=c1"));
    expect(res.status).toBe(403);
  });

  it("childId 未指定で400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await listGET(new Request("http://localhost/api/treasures"));
    expect(res.status).toBe(400);
  });

  it("自家族でない子供は404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await listGET(new Request("http://localhost/api/treasures?childId=c-other"));
    expect(res.status).toBe(404);
  });

  it("自家族の子供のプール一覧を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.treasureItem.findMany.mockResolvedValue([
      treasureItem({ id: "i1", title: "おやつ", rarity: "COMMON", sortOrder: 0, isActive: true }),
    ]);
    const res = await listGET(new Request("http://localhost/api/treasures?childId=child-1"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.items).toHaveLength(1);
    expect(json.items[0].id).toBe("i1");
  });
});

// ─── POST /api/treasures ─────────────────────────────────────────────
describe("POST /api/treasures", () => {
  it("CHILDで403", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await listPOST(
      makeRequest("/api/treasures", { childId: "c1", title: "x", rarity: "COMMON" }),
    );
    expect(res.status).toBe(403);
  });

  it("title 空で400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await listPOST(
      makeRequest("/api/treasures", { childId: "child-1", title: "", rarity: "COMMON" }),
    );
    expect(res.status).toBe(400);
  });

  it("rarity 不正で400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await listPOST(
      makeRequest("/api/treasures", { childId: "child-1", title: "x", rarity: "MYTHIC" }),
    );
    expect(res.status).toBe(400);
  });

  it("自家族でない子供は404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await listPOST(
      makeRequest("/api/treasures", { childId: "x", title: "おやつ", rarity: "COMMON" }),
    );
    expect(res.status).toBe(404);
  });

  it("正常系: 作成して 200", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.treasureItem.create.mockResolvedValue(
      treasureItem({ id: "i1", title: "おやつ", rarity: "COMMON", sortOrder: 0, isActive: true }),
    );

    const res = await listPOST(
      makeRequest("/api/treasures", { childId: "child-1", title: "  おやつ  ", rarity: "COMMON" }),
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.item.id).toBe("i1");
    // trim されている
    expect(mockPrisma.treasureItem.create).toHaveBeenCalledWith({
      data: { childId: "child-1", title: "おやつ", rarity: "COMMON" },
      select: expect.any(Object),
    });
  });
});

// ─── PUT /api/treasures/[id] ─────────────────────────────────────────
describe("PUT /api/treasures/[id]", () => {
  it("CHILDで403", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await itemPUT(makeRequest("/api/treasures/i1", { title: "x" }), makeParams("i1"));
    expect(res.status).toBe(403);
  });

  it("自家族でないアイテムは404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.treasureItem.findFirst.mockResolvedValue(null);
    const res = await itemPUT(makeRequest("/api/treasures/i1", { title: "x" }), makeParams("i1"));
    expect(res.status).toBe(404);
  });

  it("更新項目がないと400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.treasureItem.findFirst.mockResolvedValue(treasureItem({ id: "i1" }));
    const res = await itemPUT(makeRequest("/api/treasures/i1", {}), makeParams("i1"));
    expect(res.status).toBe(400);
  });

  it("title/rarity を更新", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.treasureItem.findFirst.mockResolvedValue(treasureItem({ id: "i1" }));
    mockPrisma.treasureItem.update.mockResolvedValue(treasureItem({ id: "i1" }));

    const res = await itemPUT(
      makeRequest("/api/treasures/i1", { title: "新タイトル", rarity: "RARE" }),
      makeParams("i1"),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.treasureItem.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { title: "新タイトル", rarity: "RARE" },
      select: expect.any(Object),
    });
  });
});

// ─── DELETE /api/treasures/[id] ──────────────────────────────────────
describe("DELETE /api/treasures/[id]", () => {
  it("ソフトデリート（isActive=false に更新）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.treasureItem.findFirst.mockResolvedValue(treasureItem({ id: "i1" }));
    mockPrisma.treasureItem.update.mockResolvedValue(treasureItem({ id: "i1" }));

    const res = await itemDELETE(new Request("http://localhost/api/treasures/i1", { method: "DELETE" }), makeParams("i1"));
    expect(res.status).toBe(200);
    expect(mockPrisma.treasureItem.update).toHaveBeenCalledWith({
      where: { id: "i1" },
      data: { isActive: false },
    });
  });
});

// ─── POST /api/treasures/import ──────────────────────────────────────
describe("POST /api/treasures/import", () => {
  it("テンプレ20件を子供のプールに投入", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    // 対象子供検証 + getFamilyPlan 用の PARENT (2 回連続で findFirst が呼ばれる)
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(childUser({ id: "child-1" }))
      .mockResolvedValueOnce(parentUser({ id: "parent-1" }));
    // PREMIUM 相当。FREE だと 5 個上限を超過して 403 になる (別テストで検証)
    mockPrisma.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: new Date("2099-12-31") }),
    );
    mockPrisma.treasureItem.createMany.mockResolvedValue({ count: 20 });

    const res = await importPOST(
      makeRequest("/api/treasures/import", { childId: "child-1" }),
    );
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.count).toBe(20);
    // createMany 呼び出しの内容を確認
    const arg = mockPrisma.treasureItem.createMany.mock.calls[0][0];
    const data = arg?.data as Array<{ childId: string; sortOrder: number }>;
    expect(data.length).toBe(20);
    expect(data[0]).toMatchObject({ childId: "child-1", sortOrder: 0 });
  });
});
