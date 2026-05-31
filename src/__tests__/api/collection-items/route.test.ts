import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getChild } from "@/app/api/collection-items/route";
import { GET as getParentProxy } from "@/app/api/parent/child-view/collection-items/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { childUser, parentUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/collection-items (子供)", () => {
  it("PARENT で 403", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await getChild();
    expect(res.status).toBe(403);
  });

  it("未認証で 403", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await getChild();
    expect(res.status).toBe(403);
  });

  it("子供 → 全 80 件 + 所持アイテムは owned=true", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "c1" }) as any);
    mockPrisma.userCollectionItem.findMany.mockResolvedValue([
      {
        id: "r1",
        childId: "c1",
        itemId: "summer-01",
        season: "summer",
        count: 2,
        firstAcquiredAt: new Date("2026-06-01T00:00:00Z"),
        lastAcquiredAt: new Date("2026-06-05T00:00:00Z"),
      },
    ] as any);

    const res = await getChild();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.items).toHaveLength(80);
    expect(json.currentSeason).toMatch(/^(spring|summer|fall|winter)$/);

    const summer1 = json.items.find((i: { id: string }) => i.id === "summer-01");
    expect(summer1.owned).toBe(true);
    expect(summer1.count).toBe(2);

    const other = json.items.find((i: { id: string }) => i.id === "summer-02");
    expect(other.owned).toBe(false);
    expect(other.count).toBe(0);
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
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await getParentProxy(makeReq("childId=c1"));
    expect(res.status).toBe(403);
  });

  it("childId 未指定で 400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await getParentProxy(makeReq(""));
    expect(res.status).toBe(400);
  });

  it("別 family の子で 404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await getParentProxy(makeReq("childId=c-other"));
    expect(res.status).toBe(404);
  });

  it("親代理 → 子供と同形式のレスポンス", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "c1" }) as any);
    mockPrisma.userCollectionItem.findMany.mockResolvedValue([] as any);

    const res = await getParentProxy(makeReq("childId=c1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.items).toHaveLength(80);
    expect(json.items.every((i: { owned: boolean }) => i.owned === false)).toBe(true);
  });
});
