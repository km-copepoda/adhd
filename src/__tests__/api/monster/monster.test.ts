import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/monster/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { childUserWithFamily, questWithTemplate } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/monster", () => {
  it("未認証の場合、401を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("モンスター情報を正しく返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(
      childUserWithFamily({ evolutionStage: 1, studyPt: 10, staminaPt: 5, lifePt: 3, evolutionPath: "STUDY" }),
    );
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();

    expect(json.name).toBe("ドラゴン");
    expect(json.evolutionStage).toBe(1);
    expect(json.studyPt).toBe(10);
    expect(json.staminaPt).toBe(5);
    expect(json.lifePt).toBe(3);
    expect(json.pendingStudyPt).toBe(0);
    expect(json.pendingStaminaPt).toBe(0);
    expect(json.pendingLifePt).toBe(0);
    expect(json.side).toBeDefined();
    expect(json.usedEggBonuses).toBeDefined();
  });

  it("usedEggBonusesを正しく返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(
      childUserWithFamily({ usedEggBonuses: '["STUDY","STAMINA"]' }),
    );
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();

    expect(json.usedEggBonuses).toBe('["STUDY","STAMINA"]');
  });

  it("承認待ちクエストのpendingXPを正しく集計すること", async () => {
    mockGetCurrentUser.mockResolvedValue(
      childUserWithFamily({ monsterName: "ピカ", studyPt: 5, staminaPt: 3, lifePt: 1 }),
    );

    mockPrisma.questInstance.findMany.mockResolvedValue([
      // snapshotCategory は未設定（旧データ状態を再現）: template.category へフォールバックさせる
      questWithTemplate(
        { id: "q1", deadlineBonusEarned: false, photoUrl: null, snapshotCategory: undefined },
        { category: "STUDY", photoBonus: false },
      ), // +1
      questWithTemplate(
        { id: "q2", deadlineBonusEarned: true, photoUrl: null, snapshotCategory: undefined },
        { category: "STUDY", photoBonus: false },
      ), // +2
      questWithTemplate(
        { id: "q3", deadlineBonusEarned: false, photoUrl: null, snapshotCategory: undefined },
        { category: "STAMINA", photoBonus: false },
      ), // +1
      questWithTemplate(
        { id: "q4", deadlineBonusEarned: false, photoUrl: "url", snapshotCategory: undefined },
        { category: "LIFE", photoBonus: true },
      ), // +2
    ]);

    const res = await GET();
    const json = await res.json();

    expect(json.pendingStudyPt).toBe(3);   // 1+2
    expect(json.pendingStaminaPt).toBe(1); // 1
    expect(json.pendingLifePt).toBe(2);    // 2
  });

  it("monsterNameがnullの場合、nameにフォールバックすること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ monsterName: null }));
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();

    expect(json.name).toBe("太郎");
  });

  it("monsterNameもnameもnullの場合、デフォルト名を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(
      childUserWithFamily({ monsterName: null, name: null }),
    );
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();

    expect(json.name).toBe("ぼうけんしゃ");
    expect(json.evolutionPath).toBeDefined();
  });

  it("REPORTEDステータスのクエストのみ集計すること", async () => {
    mockGetCurrentUser.mockResolvedValue(
      childUserWithFamily({ monsterName: "テスト", side: "DARK" }),
    );

    await GET();

    expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith({
      where: { childId: "child-1", status: "REPORTED" },
      include: { template: true },
    });
  });

  // ─── Issue #86: 図鑑（Zukan）のテーマ別タブ対応 ──────────────────────
  // レスポンスに以下の2フィールドを追加する（未実装）。
  //   - monsterSetId: string        … 現在有効なテーマ（User.monsterSetId をそのまま返す）
  //   - ownedThemes: string[]       … ChildMonsterTheme に記録がある themeId の一覧
  //     （monsterSetId 単体では判定しない。過去に切り替えた履歴があるテーマは全て含む）
  describe("モンスターテーマ（Issue #86: 図鑑のテーマ別タブ対応）", () => {
    it("現在のmonsterSetIdと所持テーマ一覧(ownedThemes)を返すこと", async () => {
      mockGetCurrentUser.mockResolvedValue(
        childUserWithFamily({ monsterSetId: "light" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.childMonsterTheme.findMany.mockResolvedValue([
        { id: "cmt-1", childId: "child-1", themeId: "dark", activatedAt: new Date("2026-01-01"), grantReason: "default" },
        { id: "cmt-2", childId: "child-1", themeId: "light", activatedAt: new Date("2026-02-01"), grantReason: "default" },
      ]);

      const res = await GET();
      const json = await res.json();

      expect(json.monsterSetId).toBe("light");
      expect(json.ownedThemes.slice().sort()).toEqual(["dark", "light"]);
    });

    it("複数テーマを過去に切り替えた履歴がある場合、現在のmonsterSetIdに関わらず全テーマがownedThemesに含まれること", async () => {
      // dark → buddha → light と切り替えた履歴を想定。現在は light だが、
      // ownedThemes は monsterSetId 単体ではなく ChildMonsterTheme の記録で決まる。
      mockGetCurrentUser.mockResolvedValue(
        childUserWithFamily({ monsterSetId: "light" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.childMonsterTheme.findMany.mockResolvedValue([
        { id: "cmt-1", childId: "child-1", themeId: "dark", activatedAt: new Date("2026-01-01"), grantReason: "default" },
        { id: "cmt-2", childId: "child-1", themeId: "buddha", activatedAt: new Date("2026-02-01"), grantReason: "purchase" },
        { id: "cmt-3", childId: "child-1", themeId: "light", activatedAt: new Date("2026-03-01"), grantReason: "switch" },
      ]);

      const res = await GET();
      const json = await res.json();

      expect(json.ownedThemes.slice().sort()).toEqual(["buddha", "dark", "light"]);
      expect(json.ownedThemes).toHaveLength(3);
    });

    it("isFree:falseのテーマ（buddha）は、ChildMonsterThemeにレコードが無く現在テーマでもない場合はownedThemesに含まれないこと（回帰確認）", async () => {
      mockGetCurrentUser.mockResolvedValue(
        childUserWithFamily({ monsterSetId: "dark" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.childMonsterTheme.findMany.mockResolvedValue([
        { id: "cmt-1", childId: "child-1", themeId: "dark", activatedAt: new Date("2026-01-01"), grantReason: "default" },
      ]);

      const res = await GET();
      const json = await res.json();

      expect(json.ownedThemes).not.toContain("buddha");
    });

    it("isFree:trueのテーマ（dark, light）はChildMonsterThemeにレコードが無くてもownedThemesに含まれること", async () => {
      mockGetCurrentUser.mockResolvedValue(
        childUserWithFamily({ monsterSetId: "dark" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.childMonsterTheme.findMany.mockResolvedValue([]);

      const res = await GET();
      const json = await res.json();

      expect(json.ownedThemes.slice().sort()).toEqual(["dark", "light"]);
      expect(json.ownedThemes).not.toContain("buddha");
    });

    it("現在のmonsterSetId（レコードがまだ無いケース）はisFree:falseのテーマでもownedThemesに含まれること", async () => {
      // 移行直後など、monsterSetId は buddha だが ChildMonsterTheme レコードがまだ
      // 作成されていないケースを想定。
      mockGetCurrentUser.mockResolvedValue(
        childUserWithFamily({ monsterSetId: "buddha" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.childMonsterTheme.findMany.mockResolvedValue([]);

      const res = await GET();
      const json = await res.json();

      expect(json.ownedThemes).toContain("buddha");
      expect(json.ownedThemes.slice().sort()).toEqual(["buddha", "dark", "light"]);
    });

    it("境界値: dark→light切替済みでChildMonsterThemeにlightのレコードのみある場合でも、dark（無料テーマ）とlightの両方がownedThemesに含まれること", async () => {
      mockGetCurrentUser.mockResolvedValue(
        childUserWithFamily({ monsterSetId: "light" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.childMonsterTheme.findMany.mockResolvedValue([
        { id: "cmt-1", childId: "child-1", themeId: "light", activatedAt: new Date("2026-03-01"), grantReason: "switch" },
      ]);

      const res = await GET();
      const json = await res.json();

      expect(json.ownedThemes).toContain("dark");
      expect(json.ownedThemes).toContain("light");
      expect(json.ownedThemes.slice().sort()).toEqual(["dark", "light"]);
    });

    it("ChildMonsterThemeの検索はログイン中の子供のchildIdで絞り込むこと", async () => {
      mockGetCurrentUser.mockResolvedValue(
        childUserWithFamily({ id: "child-99", monsterSetId: "dark" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.childMonsterTheme.findMany.mockResolvedValue([]);

      await GET();

      expect(mockPrisma.childMonsterTheme.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ childId: "child-99" }),
        }),
      );
    });
  });
});
