import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/gathering/stamps/received-today/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { childUser, parentUser } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/gathering/stamps/received-today", () => {
  it("未認証は401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("PARENTは401（子供専用）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("グループ未参加は空配列を返す（200）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ stamps: [] });
  });

  it("自グループ・今日の Stamp を返す（自分の送信は除外）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as never);
    vi.mocked(prisma.gatheringMember.findUnique).mockResolvedValue({
      groupId: "g-1",
    } as never);
    vi.mocked(prisma.stamp.findMany).mockResolvedValue([
      {
        id: "s-2",
        senderId: "child-2",
        sender: { monsterName: "ピカ", name: "じろう" },
      },
      {
        id: "s-3",
        senderId: "child-3",
        sender: { monsterName: null, name: "さぶろう" },
      },
    ] as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.stamps).toHaveLength(2);
    expect(data.stamps[0]).toMatchObject({ id: "s-2", senderId: "child-2", senderName: "ピカ" });
    expect(data.stamps[1]).toMatchObject({ id: "s-3", senderId: "child-3", senderName: "さぶろう" });

    // findMany の where に自分を除外するクエリと当日 + groupId が含まれていること
    const call = vi.mocked(prisma.stamp.findMany).mock.calls[0][0] as {
      where: { groupId: string; senderId: { not: string }; date: Date };
    };
    expect(call.where.groupId).toBe("g-1");
    expect(call.where.senderId).toEqual({ not: "child-1" });
    expect(call.where.date).toBeInstanceOf(Date);
  });
});
