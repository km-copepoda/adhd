import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/family/code/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, family } from "../../helpers/fixtures";
import type { Prisma } from "@/generated/prisma/client";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

/**
 * `prisma.family.findUnique` は
 * `include: { users: { include: { streak: { select: ... } } } }` 付きで呼ばれる想定
 * （Issue #111: ownedThemes はもはや子供単位の `monsterThemes` include ではなく、
 * `prisma.familyMonsterTheme.findMany({ where: { familyId } })` の家族単位クエリで
 * 別途取得し、全メンバーに共通適用する）。
 * DeepMockProxy の `mockResolvedValue` は関係（リレーション）を含まないベースの `Family` 型
 * しか受け付けない（`users` プロパティ自体が型エラーになる）ため、
 * `Prisma.FamilyGetPayload<{ include: ... }>` で実際のクエリ形状の値を組み立てたうえで、
 * モック関数の戻り値型へ `as unknown as` でキャストする。
 */
type FamilyWithUsersAndStreak = Prisma.FamilyGetPayload<{
  include: {
    users: {
      include: {
        streak: { select: { lastLoginDate: true } };
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
  // ownedThemes 計算用の家族単位所持レコード取得。デフォルトは「所持なし」。
  mockPrisma.familyMonsterTheme.findMany.mockResolvedValue([]);
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
      rubyEnabled: true,
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

  it("usersをcreatedAt昇順で取得し、familyMonsterThemeを自ファミリーのfamilyIdで取得すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockFamilyFindUnique({ ...family(), users: [] });

    await GET();

    expect(mockPrisma.family.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "fam-1" },
        include: expect.objectContaining({
          users: expect.objectContaining({
            orderBy: { createdAt: "asc" },
          }),
        }),
      }),
    );
    // ownedThemes はもはや子供単位の include (monsterThemes) ではなく、
    // 家族単位の FamilyMonsterTheme を別クエリで取得する
    expect(mockPrisma.familyMonsterTheme.findMany).toHaveBeenCalledWith({
      where: { familyId: "fam-1" },
    });
  });

  it("トップレベルにownedThemesを返し、子供が0人でも家族所持の有料テーマと無料テーマが含まれること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.familyMonsterTheme.findMany.mockResolvedValue([
      { id: "fmt-1", familyId: "fam-1", themeId: "buddha", activatedAt: new Date("2026-02-01"), grantReason: "purchase" },
    ]);
    mockFamilyFindUnique({ ...family(), users: [] });

    const res = await GET();
    const json = await res.json();

    expect(json.ownedThemes).toEqual(expect.arrayContaining(["dark", "light", "buddha"]));
  });

  describe("ownedThemes（Issue #111: 家族単位所持への移行、兄弟共有）", () => {
    it("家族がbuddhaを所持している場合、子供2人の両方のmembers[].ownedThemesにbuddhaが含まれること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.familyMonsterTheme.findMany.mockResolvedValue([
        { id: "fmt-1", familyId: "fam-1", themeId: "buddha", activatedAt: new Date("2026-02-01"), grantReason: "purchase" },
      ]);
      mockFamilyFindUnique({
        ...family(),
        users: [
          legacyMemberRow({
            id: "child-a",
            name: "太郎",
            role: "CHILD",
            monsterName: "ドラゴン",
            side: "DARK",
            childCode: "1111",
            monsterSetId: "dark",
          }),
          legacyMemberRow({
            id: "child-b",
            name: "次郎",
            role: "CHILD",
            monsterName: "スライム",
            side: "LIGHT",
            childCode: "2222",
            monsterSetId: "light",
          }),
        ],
      });

      const res = await GET();
      const json = await res.json();

      expect(json.members).toHaveLength(2);
      expect(json.members[0].ownedThemes).toContain("buddha");
      expect(json.members[1].ownedThemes).toContain("buddha");
    });

    it("家族の所持レコードが無い場合、各memberのownedThemesは無料テーマ+自身のmonsterSetIdのみになること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.familyMonsterTheme.findMany.mockResolvedValue([]);
      mockFamilyFindUnique({
        ...family(),
        users: [
          legacyMemberRow({
            id: "child-a",
            name: "太郎",
            role: "CHILD",
            monsterName: "ドラゴン",
            side: "DARK",
            childCode: "1111",
            monsterSetId: "dark",
          }),
          legacyMemberRow({
            id: "child-b",
            name: "次郎",
            role: "CHILD",
            monsterName: "スライム",
            side: "LIGHT",
            childCode: "2222",
            monsterSetId: "light",
          }),
        ],
      });

      const res = await GET();
      const json = await res.json();

      expect(json.members[0].ownedThemes.slice().sort()).toEqual(["dark", "light"]);
      expect(json.members[0].ownedThemes).not.toContain("buddha");
      expect(json.members[1].ownedThemes.slice().sort()).toEqual(["dark", "light"]);
      expect(json.members[1].ownedThemes).not.toContain("buddha");
    });

    it("子供ごとに異なるmonsterSetIdを持つ場合、ownedThemesの母集団は共通だが各memberのmonsterSetIdは個別に返ること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.familyMonsterTheme.findMany.mockResolvedValue([
        { id: "fmt-1", familyId: "fam-1", themeId: "buddha", activatedAt: new Date("2026-02-01"), grantReason: "purchase" },
      ]);
      mockFamilyFindUnique({
        ...family(),
        users: [
          legacyMemberRow({
            id: "child-a",
            name: "太郎",
            role: "CHILD",
            monsterName: "ドラゴン",
            side: "DARK",
            childCode: "1111",
            monsterSetId: "buddha",
          }),
          legacyMemberRow({
            id: "child-b",
            name: "次郎",
            role: "CHILD",
            monsterName: "スライム",
            side: "LIGHT",
            childCode: "2222",
            monsterSetId: "light",
          }),
        ],
      });

      const res = await GET();
      const json = await res.json();

      // 母集団（buddha を含む所持テーマ一覧）は共通
      expect(json.members[0].ownedThemes.slice().sort()).toEqual(["buddha", "dark", "light"]);
      expect(json.members[1].ownedThemes.slice().sort()).toEqual(["buddha", "dark", "light"]);
      // 現在有効なテーマ (monsterSetId) は個別に返る
      expect(json.members[0].monsterSetId).toBe("buddha");
      expect(json.members[1].monsterSetId).toBe("light");
    });
  });

  describe("CHILDロールへの出力制限（#184）", () => {
    const rows = () => [
      legacyMemberRow({ id: "child-1", name: "A", role: "CHILD", monsterName: "m1", side: "DARK", childCode: "1111" }),
      legacyMemberRow({ id: "child-2", name: "B", role: "CHILD", monsterName: "m2", side: "LIGHT", childCode: "2222" }),
      legacyMemberRow({ id: "parent-1", name: "P", role: "PARENT", monsterName: null, side: null, childCode: null }),
    ];

    it("CHILDには家族コードを返さず、自分以外のメンバー（兄弟のchildCode）も含めないこと", async () => {
      mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1", familyId: "fam-1" }));
      mockFamilyFindUnique({ ...family(), users: rows() } as unknown as FamilyWithUsersAndStreak);
      const res = await GET();
      const json = await res.json();
      expect(json.code).toBeNull();
      expect(json.members.map((m: { id: string }) => m.id)).toEqual(["child-1"]);
      const text = JSON.stringify(json);
      expect(text).not.toContain("2222");
      expect(text).not.toContain(family().code);
    });

    it("PARENTには従来どおり家族コードと全メンバーのchildCodeを返すこと", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-1" }));
      mockFamilyFindUnique({ ...family(), users: rows() } as unknown as FamilyWithUsersAndStreak);
      const json = await (await GET()).json();
      expect(json.code).toBe(family().code);
      expect(json.members.map((m: { childCode: string | null }) => m.childCode)).toEqual(["1111", "2222", null]);
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

  it("再生成でコードが重複(P2002)した場合、リトライして成功すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.family.update
      .mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }))
      .mockResolvedValueOnce(family({ code: "RETRY2" }));

    const res = await POST();
    expect(res.status).toBe(200);
    expect((await res.json()).code).toBe("RETRY2");
    expect(mockPrisma.family.update).toHaveBeenCalledTimes(2);
  });

  it("新規作成でもコード重複時にリトライすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    mockPrisma.family.create
      .mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }))
      .mockResolvedValueOnce(family({ code: "RETRY3" }));

    const res = await POST();
    expect((await res.json()).code).toBe("RETRY3");
    expect(mockPrisma.family.create).toHaveBeenCalledTimes(2);
  });

  it("重複が上限回数続いた場合、500を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.family.update.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));

    const res = await POST();
    expect(res.status).toBe(500);
    expect(mockPrisma.family.update).toHaveBeenCalledTimes(5);
  });

  it("P2002 以外のエラーはリトライせず500を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.family.update.mockRejectedValue(new Error("db down"));

    const res = await POST();
    expect(res.status).toBe(500);
    expect(mockPrisma.family.update).toHaveBeenCalledTimes(1);
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
