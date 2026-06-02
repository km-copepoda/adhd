import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/parent/child-view/treasures/open/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { openOldestTreasure } from "@/lib/treasureService";
import { sendPushToParent } from "@/lib/push";
import { childUser, parentUser } from "../../../helpers/fixtures";

vi.mock("@/lib/treasureService", () => ({
  openOldestTreasure: vi.fn(),
}));

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockOpen = vi.mocked(openOldestTreasure);
const mockSendPushToParent = vi.mocked(sendPushToParent);

function makeReq(body: unknown) {
  return new Request("http://localhost/api/parent/child-view/treasures/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.treasureLog.count.mockResolvedValue(0);
});

describe("POST /api/parent/child-view/treasures/open", () => {
  it("未認証で401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeReq({ childId: "child-1" }));
    expect(res.status).toBe(401);
  });

  it("CHILD ロールで403", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await POST(makeReq({ childId: "child-1" }));
    expect(res.status).toBe(403);
  });

  it("childId 未指定で400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("別 family の子を指定された場合、404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq({ childId: "child-other" }));
    expect(res.status).toBe(404);
  });

  it("UNLOCKED 宝箱が無いと400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockOpen.mockResolvedValue(null);
    const res = await POST(makeReq({ childId: "child-1" }));
    expect(res.status).toBe(400);
  });

  it("親ごほうび当選でも親への Push は送らない（親が自分で操作しているため通知不要）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", name: "太郎" }) as any,
    );
    mockOpen.mockResolvedValue({
      logId: "log-1",
      item: { id: "i1", title: "おやつ", rarity: "COMMON" },
      collectionItem: null,
    });
    mockPrisma.treasureLog.count.mockResolvedValue(2);

    const res = await POST(makeReq({ childId: "child-1" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.item.title).toBe("おやつ");
    expect(json.collectionItem).toBeNull();
    expect(json.remainingUnlocked).toBe(2);
    expect(mockSendPushToParent).not.toHaveBeenCalled();

    // openOldestTreasure は子供の id で呼ばれること
    expect(mockOpen).toHaveBeenCalledWith("child-1");
  });

  it("コレクション獲得時もハンドリング (item=null, collectionItem 付与) を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockOpen.mockResolvedValue({
      logId: "log-2",
      item: null,
      collectionItem: {
        id: "summer-01",
        name: "カブトムシ",
        rarity: "COMMON",
        season: "summer",
        description: "夏の王様。つのがかっこいい",
        image: "/collection-items/summer/カブトムシ.png",
        count: 1,
      },
    });

    const res = await POST(makeReq({ childId: "child-1" }));
    const json = await res.json();

    expect(json.item).toBeNull();
    expect(json.collectionItem).toMatchObject({ id: "summer-01", name: "カブトムシ" });
    expect(mockSendPushToParent).not.toHaveBeenCalled();
  });

  it("レスポンスに pityTriggered フィールドは含まない (pity 廃止)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockOpen.mockResolvedValue({
      logId: "log-3",
      item: { id: "i1", title: "本", rarity: "RARE" },
      collectionItem: null,
    });

    const res = await POST(makeReq({ childId: "child-1" }));
    const json = await res.json();
    expect(json).not.toHaveProperty("pityTriggered");
  });
});
