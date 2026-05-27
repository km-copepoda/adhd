import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/treasures/open/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { openOldestTreasure } from "@/lib/treasureService";
import { sendPushToParent } from "@/lib/push";
import { childUser, parentUser } from "../../helpers/fixtures";

vi.mock("@/lib/treasureService", () => ({
  openOldestTreasure: vi.fn(),
}));

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockOpen = vi.mocked(openOldestTreasure);
const mockSendPushToParent = vi.mocked(sendPushToParent);

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

  it("当たり時: 親に Push を送る", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ name: "太郎" }) as any);
    mockOpen.mockResolvedValue({
      logId: "log-1",
      item: { id: "i1", title: "おやつ", rarity: "COMMON" },
      miss: false,
      pityTriggered: false,
      nextPityCount: 0,
    });
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as any);
    mockPrisma.treasureLog.count.mockResolvedValue(2);

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.miss).toBe(false);
    expect(json.item.title).toBe("おやつ");
    expect(json.remainingUnlocked).toBe(2);
    expect(mockSendPushToParent).toHaveBeenCalledWith(
      "parent-1",
      expect.objectContaining({
        title: expect.stringContaining("ごほうび"),
        body: expect.stringContaining("おやつ"),
      }),
    );
  });

  it("ハズレ時: Push は送らない", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockOpen.mockResolvedValue({
      logId: "log-2",
      item: null,
      miss: true,
      pityTriggered: false,
      nextPityCount: 1,
    });

    const res = await POST();
    const json = await res.json();

    expect(json.miss).toBe(true);
    expect(json.item).toBeNull();
    expect(mockSendPushToParent).not.toHaveBeenCalled();
  });

  it("天井発動 (pityTriggered=true) フラグを返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockOpen.mockResolvedValue({
      logId: "log-3",
      item: { id: "i1", title: "本", rarity: "RARE" },
      miss: false,
      pityTriggered: true,
      nextPityCount: 0,
    });
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await POST();
    const json = await res.json();
    expect(json.pityTriggered).toBe(true);
  });
});
