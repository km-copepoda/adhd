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

  // ─── Issue #86: 図鑑（Zukan）のテーマ別タブ対応 ──────────────────────
  // 親代理ビューの ZukanContent 再利用に monsterSetId / ownedThemes が必要。
  // /api/monster（子供本人用）に追加済みの5件のテストと同水準のカバレッジを移植する。
  describe("モンスターテーマ（Issue #86: 図鑑のテーマ別タブ対応）", () => {
    it("現在のmonsterSetIdと所持テーマ一覧(ownedThemes)を返すこと", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", monsterSetId: "light" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.childMonsterTheme.findMany.mockResolvedValue([
        { id: "cmt-1", childId: "child-1", themeId: "dark", activatedAt: new Date("2026-01-01"), grantReason: "default" },
        { id: "cmt-2", childId: "child-1", themeId: "light", activatedAt: new Date("2026-02-01"), grantReason: "default" },
      ]);

      const res = await GET(makeReq("child-1"));
      const json = await res.json();

      expect(json.monsterSetId).toBe("light");
      expect(json.ownedThemes.slice().sort()).toEqual(["dark", "light"]);
    });

    it("複数テーマを過去に切り替えた履歴がある場合、現在のmonsterSetIdに関わらず全テーマがownedThemesに含まれること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", monsterSetId: "light" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.childMonsterTheme.findMany.mockResolvedValue([
        { id: "cmt-1", childId: "child-1", themeId: "dark", activatedAt: new Date("2026-01-01"), grantReason: "default" },
        { id: "cmt-2", childId: "child-1", themeId: "buddha", activatedAt: new Date("2026-02-01"), grantReason: "purchase" },
        { id: "cmt-3", childId: "child-1", themeId: "light", activatedAt: new Date("2026-03-01"), grantReason: "switch" },
      ]);

      const res = await GET(makeReq("child-1"));
      const json = await res.json();

      expect(json.ownedThemes.slice().sort()).toEqual(["buddha", "dark", "light"]);
      expect(json.ownedThemes).toHaveLength(3);
    });

    it("isFree:falseのテーマ（buddha）は、ChildMonsterThemeにレコードが無く現在テーマでもない場合はownedThemesに含まれないこと（回帰確認）", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", monsterSetId: "dark" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.childMonsterTheme.findMany.mockResolvedValue([
        { id: "cmt-1", childId: "child-1", themeId: "dark", activatedAt: new Date("2026-01-01"), grantReason: "default" },
      ]);

      const res = await GET(makeReq("child-1"));
      const json = await res.json();

      expect(json.ownedThemes).not.toContain("buddha");
    });

    it("isFree:trueのテーマ（dark, light）はChildMonsterThemeにレコードが無くてもownedThemesに含まれること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", monsterSetId: "dark" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.childMonsterTheme.findMany.mockResolvedValue([]);

      const res = await GET(makeReq("child-1"));
      const json = await res.json();

      expect(json.ownedThemes.slice().sort()).toEqual(["dark", "light"]);
      expect(json.ownedThemes).not.toContain("buddha");
    });

    it("現在のmonsterSetId（レコードがまだ無いケース）はisFree:falseのテーマでもownedThemesに含まれること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", monsterSetId: "buddha" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.childMonsterTheme.findMany.mockResolvedValue([]);

      const res = await GET(makeReq("child-1"));
      const json = await res.json();

      expect(json.ownedThemes).toContain("buddha");
      expect(json.ownedThemes.slice().sort()).toEqual(["buddha", "dark", "light"]);
    });

    it("境界値: dark→light切替済みでChildMonsterThemeにlightのレコードのみある場合でも、dark（無料テーマ）とlightの両方がownedThemesに含まれること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", monsterSetId: "light" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.childMonsterTheme.findMany.mockResolvedValue([
        { id: "cmt-1", childId: "child-1", themeId: "light", activatedAt: new Date("2026-03-01"), grantReason: "switch" },
      ]);

      const res = await GET(makeReq("child-1"));
      const json = await res.json();

      expect(json.ownedThemes).toContain("dark");
      expect(json.ownedThemes).toContain("light");
      expect(json.ownedThemes.slice().sort()).toEqual(["dark", "light"]);
    });

    it("ChildMonsterThemeの検索は対象の子供のchildIdで絞り込むこと", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-99", monsterSetId: "dark" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.childMonsterTheme.findMany.mockResolvedValue([]);

      await GET(makeReq("child-99"));

      expect(mockPrisma.childMonsterTheme.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ childId: "child-99" }),
        }),
      );
    });
  });
});
