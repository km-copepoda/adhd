import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/family/code/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, family } from "../../helpers/fixtures";
import type { Prisma } from "@/generated/prisma/client";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

/**
 * `prisma.family.findUnique` は
 * `include: { users: { include: { streak: { select: ... }, monsterThemes: { select: { themeId: true } } } } }`
 * 付きで呼ばれる想定（Issue #90: ownedThemes をレスポンスに含めるため）が、DeepMockProxy の
 * `mockResolvedValue` は関係（リレーション）を含まないベースの `Family` 型しか受け付けない
 * （`users` プロパティ自体が型エラーになる）。
 * `Prisma.FamilyGetPayload<{ include: ... }>` で実際のクエリ形状の値を組み立てたうえで、
 * モック関数の戻り値型へ `as unknown as` でキャストする。
 */
type FamilyWithUsersAndStreak = Prisma.FamilyGetPayload<{
  include: {
    users: {
      include: {
        streak: { select: { lastLoginDate: true } };
        monsterThemes: { select: { themeId: true } };
      };
    };
  };
}>;

function mockFamilyFindUnique(payload: FamilyWithUsersAndStreak | null) {
  mockPrisma.family.findUnique.mockResolvedValue(
    payload as unknown as Awaited<ReturnType<typeof mockPrisma.family.findUnique>>,
  );
}

/**
 * `route.ts` の members map は `u.evolutionStage ?? 0` 等、多数の防御的フォールバックを
 * 持つ。旧テスト（`as any`）は一部フィールドを欠いたメンバー行を渡しており、これらの
 * フォールバック分岐は「欠落データ」を前提に到達していた。フィクスチャの完全な値だけを
 * 使うとこの分岐が到達不能になりカバレッジが下がるため、旧データ状態を意図的に再現する
 * （`src/__tests__/api/rebirth/rebirth.test.ts` 等と同じ「フィールド欠落の再現」パターン）。
 */
function legacyMemberRow(
  fields: Pick<FamilyWithUsersAndStreak["users"][number], "id" | "name" | "role" | "monsterName" | "side" | "childCode"> &
    Partial<FamilyWithUsersAndStreak["users"][number]>,
): FamilyWithUsersAndStreak["users"][number] {
  return fields as unknown as FamilyWithUsersAndStreak["users"][number];
}

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
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    const res = await GET();
    const json = await res.json();
    expect(json).toEqual({ code: null, members: [] });
  });

  it("ファミリー情報とメンバー一覧を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockFamilyFindUnique({
      ...family({ code: "ABCD12" }),
      users: [
        legacyMemberRow({ id: "u1", name: "パパ", role: "PARENT", monsterName: null, side: null, childCode: null }),
        legacyMemberRow({
          id: "u2",
          name: "太郎",
          role: "CHILD",
          monsterName: "ドラゴン",
          side: "DARK",
          childCode: "1234",
        }),
      ],
    });

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
      rebirthPending: false,
      childCode: null,
      minTasksForStreak: 1,
      reportDeadlineTime: null,
      checkinDeadlineTime: null,
      questTimeNotifyEnabled: true,
      studyPt: 0,
      staminaPt: 0,
      lifePt: 0,
      collectedPaths: "[]",
      monsterSetId: "dark",
      pendingMonsterSetId: null,
      lastLoginDate: null,
      ownedThemes: ["dark", "light"],
    });
    expect(json.members[1].childCode).toBe("1234");
  });

  it("子供メンバーのXPフィールドを返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockFamilyFindUnique({
      ...family(),
      users: [
        legacyMemberRow({
          id: "u2",
          name: "太郎",
          role: "CHILD",
          monsterName: "ドラゴン",
          side: "DARK",
          childCode: "1234",
          studyPt: 5,
          staminaPt: 3,
          lifePt: 2,
        }),
      ],
    });

    const res = await GET();
    const json = await res.json();

    expect(json.members[0].studyPt).toBe(5);
    expect(json.members[0].staminaPt).toBe(3);
    expect(json.members[0].lifePt).toBe(2);
  });

  it("usersをcreatedAt昇順で取得すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockFamilyFindUnique({ ...family(), users: [] });

    await GET();

    expect(mockPrisma.family.findUnique).toHaveBeenCalledWith({
      where: { id: "fam-1" },
      include: {
        users: {
          orderBy: { createdAt: "asc" },
          include: {
            streak: { select: { lastLoginDate: true } },
            monsterThemes: { select: { themeId: true } },
          },
        },
      },
    });
  });

  describe("ownedThemes（Issue #90: ChildMonsterThemeレコードの手動付与を反映）", () => {
    it("buddhaのChildMonsterThemeレコードがある子はownedThemesにbuddhaが含まれること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockFamilyFindUnique({
        ...family(),
        users: [
          legacyMemberRow({
            id: "u2",
            name: "太郎",
            role: "CHILD",
            monsterName: "ドラゴン",
            side: "DARK",
            childCode: "1234",
            monsterSetId: "dark",
            monsterThemes: [{ themeId: "buddha" }],
          } as unknown as FamilyWithUsersAndStreak["users"][number]),
        ],
      });

      const res = await GET();
      const json = await res.json();

      expect(json.members[0].ownedThemes).toContain("buddha");
    });

    it("buddhaのChildMonsterThemeレコードが無い子はownedThemesにbuddhaが含まれないこと", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockFamilyFindUnique({
        ...family(),
        users: [
          legacyMemberRow({
            id: "u3",
            name: "次郎",
            role: "CHILD",
            monsterName: "スライム",
            side: "LIGHT",
            childCode: "5678",
            monsterSetId: "light",
            monsterThemes: [],
          } as unknown as FamilyWithUsersAndStreak["users"][number]),
        ],
      });

      const res = await GET();
      const json = await res.json();

      expect(json.members[0].ownedThemes).not.toContain("buddha");
      expect(json.members[0].ownedThemes).toEqual(["dark", "light"]);
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
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("既存ファミリーのコードを再生成すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.family.update.mockResolvedValue(family({ code: "NEWCOD" }));

    const res = await POST();
    const json = await res.json();

    expect(json.code).toBe("NEWCOD");
    expect(mockPrisma.family.update).toHaveBeenCalledWith({
      where: { id: "fam-1" },
      data: { code: expect.any(String) },
    });
  });

  it("ファミリーがない場合、新規作成すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    mockPrisma.family.create.mockResolvedValue(family({ id: "fam-new", code: "CREAT1" }));

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
