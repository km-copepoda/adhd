import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/parent/child-view/monster/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, childUser } from "../../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeReq(childId?: string) {
  const url = childId !== undefined
    ? `http://localhost/api/parent/child-view/monster?childId=${childId}`
    : "http://localhost/api/parent/child-view/monster";
  return new Request(url);
}

describe("GET /api/parent/child-view/monster", () => {
  it("未認証で401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(401);
  });

  it("CHILD ロールで403", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(403);
  });

  it("childId 未指定で400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await GET(makeReq(""));
    expect(res.status).toBe(400);
  });

  it("別 family の子を指定された場合、404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq("child-other"));
    expect(res.status).toBe(404);
  });

  it("正常系: 図鑑描画に必要な side / collectedPaths / monsterLevels / usedEggBonuses を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({
        id: "child-1",
        side: "LIGHT",
        evolutionStage: 2,
        evolutionPath: "STUDY_STUDY",
        collectedPaths: '["STUDY","STUDY_STUDY"]',
        monsterLevels: '{"STUDY_STUDY_STUDY":2}',
        usedEggBonuses: '["STUDY"]',
      }),
    );
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.side).toBe("LIGHT");
    expect(json.collectedPaths).toBe('["STUDY","STUDY_STUDY"]');
    expect(json.monsterLevels).toBe('{"STUDY_STUDY_STUDY":2}');
    expect(json.usedEggBonuses).toBe('["STUDY"]');
  });

  // ─── Issue #86 → #111: 図鑑（Zukan）のテーマ別タブ対応（家族単位所持へ移行） ──────
  // 親代理ビューの ZukanContent 再利用に monsterSetId / ownedThemes が必要。
  // /api/monster（子供本人用）に追加済みのカバレッジを移植する。所持判定は対象の子供が
  // 所属する家族の familyId で行う（兄弟間で共有される）。
  describe("モンスターテーマ（Issue #111: 家族単位所持への移行）", () => {
    it("現在のmonsterSetIdと所持テーマ一覧(ownedThemes)を返すこと", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", monsterSetId: "light", familyId: "fam-1" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.familyMonsterTheme.findMany.mockResolvedValue([
        { id: "fmt-1", familyId: "fam-1", themeId: "dark", activatedAt: new Date("2026-01-01"), grantReason: "default" },
        { id: "fmt-2", familyId: "fam-1", themeId: "light", activatedAt: new Date("2026-02-01"), grantReason: "default" },
      ]);

      const res = await GET(makeReq("child-1"));
      const json = await res.json();

      expect(json.monsterSetId).toBe("light");
      expect(json.ownedThemes.slice().sort()).toEqual(["dark", "light"]);
    });

    it("家族が所持している有料テーマ(buddha)がownedThemesに含まれること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", monsterSetId: "light", familyId: "fam-1" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.familyMonsterTheme.findMany.mockResolvedValue([
        { id: "fmt-1", familyId: "fam-1", themeId: "dark", activatedAt: new Date("2026-01-01"), grantReason: "default" },
        { id: "fmt-2", familyId: "fam-1", themeId: "buddha", activatedAt: new Date("2026-02-01"), grantReason: "purchase" },
        { id: "fmt-3", familyId: "fam-1", themeId: "light", activatedAt: new Date("2026-03-01"), grantReason: "switch" },
      ]);

      const res = await GET(makeReq("child-1"));
      const json = await res.json();

      expect(json.ownedThemes.slice().sort()).toEqual(["buddha", "dark", "light"]);
      expect(json.ownedThemes).toHaveLength(3);
    });

    it("isFree:falseのテーマ（buddha）は、FamilyMonsterThemeにレコードが無く現在テーマでもない場合はownedThemesに含まれないこと（回帰確認）", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", monsterSetId: "dark", familyId: "fam-1" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.familyMonsterTheme.findMany.mockResolvedValue([
        { id: "fmt-1", familyId: "fam-1", themeId: "dark", activatedAt: new Date("2026-01-01"), grantReason: "default" },
      ]);

      const res = await GET(makeReq("child-1"));
      const json = await res.json();

      expect(json.ownedThemes).not.toContain("buddha");
    });

    it("isFree:trueのテーマ（dark, light）はFamilyMonsterThemeにレコードが無くてもownedThemesに含まれること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", monsterSetId: "dark", familyId: "fam-1" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.familyMonsterTheme.findMany.mockResolvedValue([]);

      const res = await GET(makeReq("child-1"));
      const json = await res.json();

      expect(json.ownedThemes.slice().sort()).toEqual(["dark", "light"]);
      expect(json.ownedThemes).not.toContain("buddha");
    });

    it("現在のmonsterSetId（レコードがまだ無いケース）はisFree:falseのテーマでもownedThemesに含まれること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", monsterSetId: "buddha", familyId: "fam-1" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.familyMonsterTheme.findMany.mockResolvedValue([]);

      const res = await GET(makeReq("child-1"));
      const json = await res.json();

      expect(json.ownedThemes).toContain("buddha");
      expect(json.ownedThemes.slice().sort()).toEqual(["buddha", "dark", "light"]);
    });

    it("FamilyMonsterThemeの検索は対象の子供が所属する家族のfamilyIdで絞り込むこと", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-99", monsterSetId: "dark", familyId: "fam-99" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.familyMonsterTheme.findMany.mockResolvedValue([]);

      await GET(makeReq("child-99"));

      expect(mockPrisma.familyMonsterTheme.findMany).toHaveBeenCalledWith({
        where: { familyId: "fam-99" },
      });
    });

    it("境界値: 対象の子供のfamilyIdがnullの場合、familyMonsterTheme.findManyを呼ばず、ownedThemesは無料テーマ+monsterSetIdのみになること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", monsterSetId: "dark", familyId: null }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);

      const res = await GET(makeReq("child-1"));
      const json = await res.json();

      expect(mockPrisma.familyMonsterTheme.findMany).not.toHaveBeenCalled();
      expect(json.ownedThemes.slice().sort()).toEqual(["dark", "light"]);
      expect(json.ownedThemes).not.toContain("buddha");
    });
  });
});
