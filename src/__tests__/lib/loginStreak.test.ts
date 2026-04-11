import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordLoginActivity } from "@/lib/loginStreak";
import { childUser, streak } from "../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordLoginActivity", () => {
  const today = new Date("2026-03-29");

  it("初回ログインで loginCurrentStreak=1 になる", async () => {
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 0, loginBestStreak: 0, lastLoginDate: null }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);

    const result = await recordLoginActivity("child-1", today);

    expect(mockPrisma.streak.update).toHaveBeenCalledWith({
      where: { childId: "child-1" },
      data: {
        loginCurrentStreak: 1,
        loginBestStreak: 1,
        lastLoginDate: expect.any(Date),
      },
    });
    expect(result.loginStreak).toBe(1);
    expect(result.bonusGranted).toBe(0);
  });

  it("同日2回目のログインでは変化なし", async () => {
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 3, loginBestStreak: 5, lastLoginDate: today }) as any,
    );

    const result = await recordLoginActivity("child-1", today);

    expect(mockPrisma.streak.update).not.toHaveBeenCalled();
    expect(result.loginStreak).toBe(3);
    expect(result.bonusGranted).toBe(0);
  });

  it("昨日もログインしていれば連続日数が +1 になる", async () => {
    const yesterday = new Date("2026-03-28");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 5, loginBestStreak: 10, lastLoginDate: yesterday }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);

    const result = await recordLoginActivity("child-1", today);

    expect(mockPrisma.streak.update).toHaveBeenCalledWith({
      where: { childId: "child-1" },
      data: {
        loginCurrentStreak: 6,
        loginBestStreak: 10,
        lastLoginDate: expect.any(Date),
      },
    });
    expect(result.loginStreak).toBe(6);
  });

  it("途切れた場合は loginCurrentStreak=1 にリセット、bestStreak は保持", async () => {
    const threeDaysAgo = new Date("2026-03-26");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 10, loginBestStreak: 20, lastLoginDate: threeDaysAgo }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);

    const result = await recordLoginActivity("child-1", today);

    expect(mockPrisma.streak.update).toHaveBeenCalledWith({
      where: { childId: "child-1" },
      data: {
        loginCurrentStreak: 1,
        loginBestStreak: 20,
        lastLoginDate: expect.any(Date),
      },
    });
    expect(result.loginStreak).toBe(1);
  });

  // stage 1（閾値10pt）の子供を使い、進化が発動しない範囲でカテゴリ分配をテスト
  it("10日連続ログインで +1pt が最少カテゴリ（全同値→STUDY）に付与される", async () => {
    const yesterday = new Date("2026-03-28");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 9, loginBestStreak: 9, lastLoginDate: yesterday }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 1, evolutionPath: "STUDY", studyPt: 2, staminaPt: 2, lifePt: 2 }) as any,
    );
    mockPrisma.user.update.mockResolvedValue({} as any);

    const result = await recordLoginActivity("child-1", today);

    expect(result.loginStreak).toBe(10);
    expect(result.bonusGranted).toBe(1);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ studyPt: 3, staminaPt: 2, lifePt: 2 }),
      }),
    );
  });

  it("20日連続で +1pt が最少カテゴリ（LIFE=1）に付与される", async () => {
    const yesterday = new Date("2026-03-28");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 19, loginBestStreak: 19, lastLoginDate: yesterday }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 1, evolutionPath: "STUDY", studyPt: 3, staminaPt: 2, lifePt: 1 }) as any,
    );
    mockPrisma.user.update.mockResolvedValue({} as any);

    const result = await recordLoginActivity("child-1", today);

    expect(result.loginStreak).toBe(20);
    expect(result.bonusGranted).toBe(1);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ studyPt: 3, staminaPt: 2, lifePt: 2 }),
      }),
    );
  });

  it("+1pt が最少カテゴリ（STAMINA=1）に付与される", async () => {
    const yesterday = new Date("2026-03-28");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 29, loginBestStreak: 29, lastLoginDate: yesterday }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 1, evolutionPath: "STUDY", studyPt: 3, staminaPt: 1, lifePt: 2 }) as any,
    );
    mockPrisma.user.update.mockResolvedValue({} as any);

    const result = await recordLoginActivity("child-1", today);

    expect(result.bonusGranted).toBe(1);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ studyPt: 3, staminaPt: 2, lifePt: 2 }),
      }),
    );
  });

  it("9日連続ではボーナスなし", async () => {
    const yesterday = new Date("2026-03-28");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 8, loginBestStreak: 8, lastLoginDate: yesterday }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);

    const result = await recordLoginActivity("child-1", today);

    expect(result.bonusGranted).toBe(0);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rebirthPending中はボーナスでXPのみ加算し進化チェックをスキップ", async () => {
    const yesterday = new Date("2026-03-28");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 9, loginBestStreak: 9, lastLoginDate: yesterday }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({
        evolutionStage: 3,
        evolutionPath: "STUDY_STAMINA_LIFE",
        studyPt: 15, staminaPt: 2, lifePt: 2,
        rebirthPending: true,
        collectedPaths: '["STUDY","STUDY_STAMINA","STUDY_STAMINA_LIFE"]',
      }) as any,
    );
    mockPrisma.user.update.mockResolvedValue({} as any);

    const result = await recordLoginActivity("child-1", today);

    expect(result.bonusGranted).toBe(1);
    // XPのみ加算、進化関連フィールドなし
    const updateData = mockPrisma.user.update.mock.calls[0][0].data;
    // addBonusToMinCategory: min=2(STAMINA=LIFE) → STAMINA に+1
    expect(updateData.staminaPt).toBe(3);
    expect(updateData).not.toHaveProperty("evolutionStage");
    expect(updateData).not.toHaveProperty("evolutionPath");
  });

  it("ボーナスで進化した場合、collectedPathsとmonsterLevelsが更新される", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // STUDY が選ばれる
    const yesterday = new Date("2026-03-28");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 9, loginBestStreak: 9, lastLoginDate: yesterday }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);
    // stage1、9pt蓄積中。ボーナス1ptで total=10 → 10以上なので進化する
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({
        evolutionStage: 1,
        evolutionPath: "STUDY",
        studyPt: 4, staminaPt: 3, lifePt: 2,
        collectedPaths: '["STUDY"]',
        monsterLevels: "{}",
      }) as any,
    );
    mockPrisma.user.update.mockResolvedValue({} as any);

    await recordLoginActivity("child-1", today);

    const updateData = mockPrisma.user.update.mock.calls[0][0].data;
    expect(updateData).toHaveProperty("collectedPaths");
    expect(updateData).toHaveProperty("monsterLevels");
    expect(updateData.evolutionStage).toBe(2);

    vi.restoreAllMocks();
  });
});
