import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getChild } from "@/app/api/collection-items/route";
import { GET as getParentProxy } from "@/app/api/parent/child-view/collection-items/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { childUserWithFamily, parentUserWithFamily, childUser, userCollectionItem } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/collection-items (子供)", () => {
  it("PARENT で 403", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await getChild();
    expect(res.status).toBe(403);
  });

  it("未認証で 403", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await getChild();
    expect(res.status).toBe(403);
  });

  it("子供 → 全 140 件 (通常 80 + 月限定 60) + 所持アイテムは owned=true + currentMonth を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "c1" }));
    mockPrisma.userCollectionItem.findMany.mockResolvedValue([
      userCollectionItem({
        id: "r1",
        childId: "c1",
        itemId: "summer-01",
        season: "summer",
        count: 2,
        firstAcquiredAt: new Date("2026-06-01T00:00:00Z"),
        lastAcquiredAt: new Date("2026-06-05T00:00:00Z"),
      }),
    ]);

    const res = await getChild();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.items).toHaveLength(140);
    expect(json.currentSeason).toMatch(/^(spring|summer|fall|winter)$/);
    expect(json.currentMonth).toBeGreaterThanOrEqual(1);
    expect(json.currentMonth).toBeLessThanOrEqual(12);

    const summer1 = json.items.find((i: { id: string }) => i.id === "summer-01");
    expect(summer1.owned).toBe(true);
    expect(summer1.count).toBe(2);

    const other = json.items.find((i: { id: string }) => i.id === "summer-02");
    expect(other.owned).toBe(false);
    expect(other.count).toBe(0);

    // 月限定アイテムがマスターに含まれ、month フィールドを持つ
    const monthly = json.items.find((i: { id: string }) => i.id === "m07-01");
    expect(monthly).toBeDefined();
    expect(monthly.month).toBe(7);
  });

  it("Issue #139: レスポンスの各アイテムにnameKana/descriptionKanaが含まれる（CollectionItemへのkana追加がAPIへ自動反映されることの確認）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "c1" }));
    mockPrisma.userCollectionItem.findMany.mockResolvedValue([]);

    const res = await getChild();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.items.length).toBeGreaterThan(0);
    for (const item of json.items) {
      expect(typeof item.nameKana).toBe("string");
      expect(item.nameKana.length).toBeGreaterThan(0);
      expect(typeof item.descriptionKana).toBe("string");
      expect(item.descriptionKana.length).toBeGreaterThan(0);
    }
  });

  // ─── Issue #140: モンスター図鑑・コレクションアイテムの表示にrubyEnabledを配線 ──
  describe("rubyEnabled（Issue #140）", () => {
    it("user.rubyEnabled=true のとき、レスポンスの rubyEnabled も true", async () => {
      mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "c1", rubyEnabled: true }));
      mockPrisma.userCollectionItem.findMany.mockResolvedValue([]);

      const res = await getChild();
      const json = await res.json();

      expect(json.rubyEnabled).toBe(true);
    });

    it("user.rubyEnabled=false のとき、レスポンスの rubyEnabled も false", async () => {
      mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "c1", rubyEnabled: false }));
      mockPrisma.userCollectionItem.findMany.mockResolvedValue([]);

      const res = await getChild();
      const json = await res.json();

      expect(json.rubyEnabled).toBe(false);
    });

    it.each([undefined, null, "true", 1])(
      "境界値: user.rubyEnabled が非boolean(%s)のとき、trueにフォールバックすること",
      async (value) => {
        mockGetCurrentUser.mockResolvedValue(
          childUserWithFamily({ id: "c1", rubyEnabled: value as unknown as boolean }),
        );
        mockPrisma.userCollectionItem.findMany.mockResolvedValue([]);

        const res = await getChild();
        const json = await res.json();

        expect(json.rubyEnabled).toBe(true);
      },
    );
  });
});

describe("GET /api/parent/child-view/collection-items (親代理)", () => {
  function makeReq(query: string) {
    return new Request(`http://localhost/api/parent/child-view/collection-items?${query}`);
  }

  it("未認証で 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await getParentProxy(makeReq("childId=c1"));
    expect(res.status).toBe(401);
  });

  it("CHILD で 403 (PARENT のみ許可)", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await getParentProxy(makeReq("childId=c1"));
    expect(res.status).toBe(403);
  });

  it("childId 未指定で 400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await getParentProxy(makeReq(""));
    expect(res.status).toBe(400);
  });

  it("別 family の子で 404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await getParentProxy(makeReq("childId=c-other"));
    expect(res.status).toBe(404);
  });

  it("親代理 → 子供と同形式のレスポンス", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "c1" }));
    mockPrisma.userCollectionItem.findMany.mockResolvedValue([]);

    const res = await getParentProxy(makeReq("childId=c1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.items).toHaveLength(140);
    expect(json.currentMonth).toBeGreaterThanOrEqual(1);
    expect(json.currentMonth).toBeLessThanOrEqual(12);
    expect(json.items.every((i: { owned: boolean }) => i.owned === false)).toBe(true);
  });

  it("Issue #139: レスポンスの各アイテムにnameKana/descriptionKanaが含まれる", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "c1" }));
    mockPrisma.userCollectionItem.findMany.mockResolvedValue([]);

    const res = await getParentProxy(makeReq("childId=c1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.items.length).toBeGreaterThan(0);
    for (const item of json.items) {
      expect(typeof item.nameKana).toBe("string");
      expect(item.nameKana.length).toBeGreaterThan(0);
      expect(typeof item.descriptionKana).toBe("string");
      expect(item.descriptionKana.length).toBeGreaterThan(0);
    }
  });

  // ─── Issue #140: モンスター図鑑・コレクションアイテムの表示にrubyEnabledを配線 ──
  // 親代理ルートは対象児童の rubyEnabled を返す（親自身の値ではない）。
  describe("rubyEnabled（Issue #140）", () => {
    it("対象児童（child）のrubyEnabledを返す。親自身の値ではないこと", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ rubyEnabled: false }));
      mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "c1", rubyEnabled: true }));
      mockPrisma.userCollectionItem.findMany.mockResolvedValue([]);

      const res = await getParentProxy(makeReq("childId=c1"));
      const json = await res.json();

      expect(json.rubyEnabled).toBe(true);
    });

    it("対象児童のrubyEnabled=falseのとき、親がtrueでもfalseを返す", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ rubyEnabled: true }));
      mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "c1", rubyEnabled: false }));
      mockPrisma.userCollectionItem.findMany.mockResolvedValue([]);

      const res = await getParentProxy(makeReq("childId=c1"));
      const json = await res.json();

      expect(json.rubyEnabled).toBe(false);
    });

    it.each([undefined, null, "true", 1])(
      "境界値: 対象児童のrubyEnabledが非boolean(%s)のとき、trueにフォールバックすること",
      async (value) => {
        mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
        mockPrisma.user.findFirst.mockResolvedValue(
          childUser({ id: "c1", rubyEnabled: value as unknown as boolean }),
        );
        mockPrisma.userCollectionItem.findMany.mockResolvedValue([]);

        const res = await getParentProxy(makeReq("childId=c1"));
        const json = await res.json();

        expect(json.rubyEnabled).toBe(true);
      },
    );
  });
});
