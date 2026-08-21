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

  // ─── Issue #86 → #111: 図鑑（Zukan）のテーマ別タブ対応（家族単位所持へ移行） ──────
  // レスポンスに以下の2フィールドを追加する。
  //   - monsterSetId: string        … 現在有効なテーマ（User.monsterSetId をそのまま返す）
  //   - ownedThemes: string[]       … FamilyMonsterTheme（家族単位）に記録がある themeId の一覧
  //     （monsterSetId 単体では判定しない。過去に家族が切り替えた履歴があるテーマは全て含む。
  //     兄弟間で所持を共有するため、家族の familyId で絞り込む）
  describe("モンスターテーマ（Issue #111: 家族単位所持への移行）", () => {
    it("現在のmonsterSetIdと所持テーマ一覧(ownedThemes)を返すこと", async () => {
      mockGetCurrentUser.mockResolvedValue(
        childUserWithFamily({ monsterSetId: "light", familyId: "fam-1" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.familyMonsterTheme.findMany.mockResolvedValue([
        { id: "fmt-1", familyId: "fam-1", themeId: "dark", activatedAt: new Date("2026-01-01"), grantReason: "default" },
        { id: "fmt-2", familyId: "fam-1", themeId: "light", activatedAt: new Date("2026-02-01"), grantReason: "default" },
      ]);

      const res = await GET();
      const json = await res.json();

      expect(json.monsterSetId).toBe("light");
      expect(json.ownedThemes.slice().sort()).toEqual(["dark", "light"]);
    });

    it("家族が所持している有料テーマ(buddha)がownedThemesに含まれること", async () => {
      mockGetCurrentUser.mockResolvedValue(
        childUserWithFamily({ monsterSetId: "light", familyId: "fam-1" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.familyMonsterTheme.findMany.mockResolvedValue([
        { id: "fmt-1", familyId: "fam-1", themeId: "dark", activatedAt: new Date("2026-01-01"), grantReason: "default" },
        { id: "fmt-2", familyId: "fam-1", themeId: "buddha", activatedAt: new Date("2026-02-01"), grantReason: "purchase" },
        { id: "fmt-3", familyId: "fam-1", themeId: "light", activatedAt: new Date("2026-03-01"), grantReason: "switch" },
      ]);

      const res = await GET();
      const json = await res.json();

      expect(json.ownedThemes.slice().sort()).toEqual(["buddha", "dark", "light"]);
      expect(json.ownedThemes).toHaveLength(3);
    });

    it("isFree:falseのテーマ（buddha）は、FamilyMonsterThemeにレコードが無く現在テーマでもない場合はownedThemesに含まれないこと（回帰確認）", async () => {
      mockGetCurrentUser.mockResolvedValue(
        childUserWithFamily({ monsterSetId: "dark", familyId: "fam-1" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.familyMonsterTheme.findMany.mockResolvedValue([
        { id: "fmt-1", familyId: "fam-1", themeId: "dark", activatedAt: new Date("2026-01-01"), grantReason: "default" },
      ]);

      const res = await GET();
      const json = await res.json();

      expect(json.ownedThemes).not.toContain("buddha");
    });

    it("isFree:trueのテーマ（dark, light）はFamilyMonsterThemeにレコードが無くてもownedThemesに含まれること", async () => {
      mockGetCurrentUser.mockResolvedValue(
        childUserWithFamily({ monsterSetId: "dark", familyId: "fam-1" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.familyMonsterTheme.findMany.mockResolvedValue([]);

      const res = await GET();
      const json = await res.json();

      expect(json.ownedThemes.slice().sort()).toEqual(["dark", "light"]);
      expect(json.ownedThemes).not.toContain("buddha");
    });

    it("現在のmonsterSetId（レコードがまだ無いケース）はisFree:falseのテーマでもownedThemesに含まれること", async () => {
      // 移行直後など、monsterSetId は buddha だが FamilyMonsterTheme レコードがまだ
      // 作成されていないケースを想定。
      mockGetCurrentUser.mockResolvedValue(
        childUserWithFamily({ monsterSetId: "buddha", familyId: "fam-1" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.familyMonsterTheme.findMany.mockResolvedValue([]);

      const res = await GET();
      const json = await res.json();

      expect(json.ownedThemes).toContain("buddha");
      expect(json.ownedThemes.slice().sort()).toEqual(["buddha", "dark", "light"]);
    });

    it("FamilyMonsterThemeの検索はログイン中ユーザのfamilyIdで絞り込むこと", async () => {
      mockGetCurrentUser.mockResolvedValue(
        childUserWithFamily({ id: "child-99", monsterSetId: "dark", familyId: "fam-99" }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);
      mockPrisma.familyMonsterTheme.findMany.mockResolvedValue([]);

      await GET();

      expect(mockPrisma.familyMonsterTheme.findMany).toHaveBeenCalledWith({
        where: { familyId: "fam-99" },
      });
    });

    it("境界値: user.familyIdがnullの場合、familyMonsterTheme.findManyを呼ばず、ownedThemesは無料テーマ+monsterSetIdのみになること", async () => {
      mockGetCurrentUser.mockResolvedValue(
        childUserWithFamily({ monsterSetId: "dark", familyId: null }),
      );
      mockPrisma.questInstance.findMany.mockResolvedValue([]);

      const res = await GET();
      const json = await res.json();

      expect(mockPrisma.familyMonsterTheme.findMany).not.toHaveBeenCalled();
      expect(json.ownedThemes.slice().sort()).toEqual(["dark", "light"]);
      expect(json.ownedThemes).not.toContain("buddha");
    });
  });
});
