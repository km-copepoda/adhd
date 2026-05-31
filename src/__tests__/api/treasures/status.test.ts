import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/treasures/status/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { childUser, parentUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/treasures/status", () => {
  it("PARENTで403", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("LOCKED/UNLOCKED 件数と OPENED 履歴を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.treasureLog.count
      .mockResolvedValueOnce(2) // LOCKED
      .mockResolvedValueOnce(3); // UNLOCKED
    mockPrisma.treasureLog.findMany.mockResolvedValue([
      {
        id: "log-1",
        openedAt: new Date("2026-03-21"),
        boosted: false,
        item: { id: "i1", title: "おやつ", rarity: "COMMON" },
      } as any,
      {
        id: "log-2",
        openedAt: new Date("2026-03-20"),
        boosted: true,
        item: null, // 親ごほうび不当選 (コレクションアイテム獲得)
      } as any,
    ]);

    const res = await GET();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.locked).toBe(2);
    expect(json.unlocked).toBe(3);
    expect(json.opened).toHaveLength(2);
    expect(json.opened[0].item.title).toBe("おやつ");
    expect(json.opened[1].item).toBeNull();
  });
});
