import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/parent/child-view/children/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, childUser } from "../../../helpers/fixtures";

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
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("familyId が無い親の場合、403 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("正常系: 家族内の CHILD を返し、モンスター画像とXPバー描画に必要なフィールドを含む", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    // `select` クエリでも DeepMockProxy の mockResolvedValue はベースの User 完全型を要求するため、
    // childUser フィクスチャで完全な値を用意する（実装は select で絞るので余剰フィールドは無視される）。
    const children = [
      childUser({
        id: "child-1",
        name: "太郎",
        monsterName: "ドラゴン",
        side: "LIGHT",
        evolutionStage: 1,
        evolutionPath: "STUDY",
        studyPt: 2,
        staminaPt: 1,
        lifePt: 0,
        collectedPaths: "[]",
        rebirthEggBonus: null,
      }),
      childUser({
        id: "child-2",
        name: "花子",
        monsterName: "ユニコーン",
        side: "DARK",
        evolutionStage: 0,
        evolutionPath: "",
        studyPt: 0,
        staminaPt: 0,
        lifePt: 0,
        collectedPaths: "[]",
        rebirthEggBonus: null,
      }),
    ];
    mockPrisma.user.findMany.mockResolvedValue(children);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveLength(2);
    expect(json[0].id).toBe("child-1");
    expect(json[0].monsterName).toBe("ドラゴン");
    expect(json[0].studyPt).toBe(2);
    expect(json[0].staminaPt).toBe(1);
    expect(json[0].lifePt).toBe(0);
    expect(json[0].collectedPaths).toBe("[]");
    expect(json[0].rebirthEggBonus).toBe(null);

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyId: "fam-1", role: "CHILD" },
        select: expect.objectContaining({
          studyPt: true,
          staminaPt: true,
          lifePt: true,
          collectedPaths: true,
          rebirthEggBonus: true,
        }),
      }),
    );
  });

  it("子供が居ない場合、空配列を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();
    expect(json).toEqual([]);
  });
});
