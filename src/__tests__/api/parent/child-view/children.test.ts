import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/parent/child-view/children/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parentUser, childUser } from "../../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/parent/child-view/children", () => {
  it("未認証の場合、401 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("CHILD ロールの場合、403 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("familyId が無い親の場合、403 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as any);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("正常系: 家族内の CHILD だけを返す（最小限フィールド）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "child-1",
        name: "太郎",
        monsterName: "ドラゴン",
        side: "LIGHT",
        evolutionStage: 1,
        evolutionPath: "STUDY",
      },
      {
        id: "child-2",
        name: "花子",
        monsterName: "ユニコーン",
        side: "DARK",
        evolutionStage: 0,
        evolutionPath: "",
      },
    ] as any);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0].id).toBe("child-1");
    expect(json[0].monsterName).toBe("ドラゴン");

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyId: "fam-1", role: "CHILD" },
      }),
    );
  });

  it("子供が居ない場合、空配列を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();
    expect(json).toEqual([]);
  });
});
