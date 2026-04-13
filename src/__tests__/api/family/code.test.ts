import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/family/code/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parentUser, childUser, family } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/family/code", () => {
  it("未認証の場合、code=null, members=[]を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    const json = await res.json();
    expect(json).toEqual({ code: null, members: [] });
  });

  it("familyIdがない場合、code=null, members=[]を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as any);
    const res = await GET();
    const json = await res.json();
    expect(json).toEqual({ code: null, members: [] });
  });

  it("ファミリー情報とメンバー一覧を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.family.findUnique.mockResolvedValue(
      family({
        code: "ABCD12",
        users: [
          { id: "u1", name: "パパ", role: "PARENT", monsterName: null, side: null, childCode: null },
          { id: "u2", name: "太郎", role: "CHILD", monsterName: "ドラゴン", side: "DARK", childCode: "1234" },
        ],
      }) as any,
    );

    const res = await GET();
    const json = await res.json();

    expect(json.code).toBe("ABCD12");
    expect(json.members).toHaveLength(2);
    expect(json.members[0]).toEqual({
      id: "u1",
      name: "パパ",
      role: "PARENT",
      monsterName: null,
      side: null,
      evolutionStage: 0,
      evolutionPath: "",
      rebirthEggBonus: null,
      childCode: null,
      minTasksForStreak: 1,
      reportDeadlineTime: null,
      studyPt: 0,
      staminaPt: 0,
      lifePt: 0,
      collectedPaths: "[]",
    });
    expect(json.members[1].childCode).toBe("1234");
  });

  it("子供メンバーのXPフィールドを返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.family.findUnique.mockResolvedValue(
      family({
        users: [
          { id: "u2", name: "太郎", role: "CHILD", monsterName: "ドラゴン", side: "DARK", childCode: "1234",
            studyPt: 5, staminaPt: 3, lifePt: 2 },
        ],
      }) as any,
    );

    const res = await GET();
    const json = await res.json();

    expect(json.members[0].studyPt).toBe(5);
    expect(json.members[0].staminaPt).toBe(3);
    expect(json.members[0].lifePt).toBe(2);
  });

  it("usersをcreatedAt昇順で取得すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.family.findUnique.mockResolvedValue(family({ users: [] }) as any);

    await GET();

    expect(mockPrisma.family.findUnique).toHaveBeenCalledWith({
      where: { id: "fam-1" },
      include: { users: { orderBy: { createdAt: "asc" } } },
    });
  });

  it("エラー時に500を返すこと", async () => {
    mockGetCurrentUser.mockRejectedValue(new Error("DB connection failed"));
    const res = await GET();
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("DB connection failed");
  });
});

describe("POST /api/family/code", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("CHILDロールの場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("既存ファミリーのコードを再生成すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.family.update.mockResolvedValue(family({ code: "NEWCOD" }) as any);

    const res = await POST();
    const json = await res.json();

    expect(json.code).toBe("NEWCOD");
    expect(mockPrisma.family.update).toHaveBeenCalledWith({
      where: { id: "fam-1" },
      data: { code: expect.any(String) },
    });
  });

  it("ファミリーがない場合、新規作成すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as any);
    mockPrisma.family.create.mockResolvedValue(family({ id: "fam-new", code: "CREAT1" }) as any);

    const res = await POST();
    const json = await res.json();

    expect(json.code).toBe("CREAT1");
    expect(mockPrisma.family.create).toHaveBeenCalledWith({
      data: {
        code: expect.any(String),
        users: { connect: { id: "parent-1" } },
      },
    });
  });
});
