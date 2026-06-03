import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/treasures/open/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { openOldestTreasure } from "@/lib/treasureService";
import { sendPushToParent } from "@/lib/push";
import { checkAndUnlockBadges } from "@/lib/badges";
import { triggerBadgeLog } from "@/lib/bulletinLog";
import { childUser, parentUser } from "../../helpers/fixtures";

vi.mock("@/lib/treasureService", () => ({
  openOldestTreasure: vi.fn(),
}));

vi.mock("@/lib/badges", async () => {
  const actual = await vi.importActual<typeof import("@/lib/badges")>("@/lib/badges");
  return {
    ...actual,
    checkAndUnlockBadges: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@/lib/bulletinLog", () => ({
  triggerBadgeLog: vi.fn().mockResolvedValue(undefined),
}));

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockOpen = vi.mocked(openOldestTreasure);
const mockSendPushToParent = vi.mocked(sendPushToParent);
const mockCheckAndUnlockBadges = vi.mocked(checkAndUnlockBadges);
const mockTriggerBadgeLog = vi.mocked(triggerBadgeLog);

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.treasureLog.count.mockResolvedValue(0);
});

describe("POST /api/treasures/open", () => {
  it("PARENTで403", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("未認証で403", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("UNLOCKED 宝箱が無いと 400", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockOpen.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(400);
  });

  it("親ごほうび当選時: 親に Push を送る", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ name: "太郎" }) as any);
    mockOpen.mockResolvedValue({
      logId: "log-1",
      item: { id: "i1", title: "おやつ", rarity: "COMMON" },
      collectionItem: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as any);
    mockPrisma.treasureLog.count.mockResolvedValue(2);

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.item.title).toBe("おやつ");
    expect(json.collectionItem).toBeNull();
    expect(json.remainingUnlocked).toBe(2);
    expect(mockSendPushToParent).toHaveBeenCalledWith(
      "parent-1",
      expect.objectContaining({
        title: expect.stringContaining("ごほうび"),
        body: expect.stringContaining("おやつ"),
      }),
    );
  });

  it("コレクション獲得時: Push は送らない / collectionItem をレスポンスに含める", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
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

    const res = await POST();
    const json = await res.json();

    expect(json.item).toBeNull();
    expect(json.collectionItem).toMatchObject({
      id: "summer-01",
      name: "カブトムシ",
      count: 1,
    });
    expect(mockSendPushToParent).not.toHaveBeenCalled();
  });

  it("レスポンスに pityTriggered フィールドは含まない (pity 廃止)", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockOpen.mockResolvedValue({
      logId: "log-3",
      item: { id: "i1", title: "本", rarity: "RARE" },
      collectionItem: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await POST();
    const json = await res.json();
    expect(json).not.toHaveProperty("pityTriggered");
  });

  it("開封後に checkAndUnlockBadges を呼ぶ（宝箱・コレクション系バッジを即時解錠）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockOpen.mockResolvedValue({
      logId: "log-4",
      item: null,
      collectionItem: {
        id: "spring-05", name: "桜", rarity: "COMMON", season: "spring",
        description: "", image: "", count: 1,
      },
    });

    const res = await POST();
    expect(res.status).toBe(200);
    await new Promise(r => setImmediate(r));

    expect(mockCheckAndUnlockBadges).toHaveBeenCalledWith("child-1");
  });

  it("新規解錠バッジを掲示板に流す（triggerBadgeLog 呼び出し）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockOpen.mockResolvedValue({
      logId: "log-5",
      item: null,
      collectionItem: {
        id: "spring-05", name: "桜", rarity: "COMMON", season: "spring",
        description: "", image: "", count: 1,
      },
    });
    mockCheckAndUnlockBadges.mockResolvedValue([
      { id: "treasure_first", name: "はじめての宝箱", emoji: "🎁", description: "..." },
    ]);

    const res = await POST();
    expect(res.status).toBe(200);
    await new Promise(r => setImmediate(r));

    expect(mockTriggerBadgeLog).toHaveBeenCalledWith("child-1", "はじめての宝箱");
  });
});
