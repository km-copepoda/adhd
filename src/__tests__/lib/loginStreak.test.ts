import { describe, it, expect, vi, beforeEach } from "vitest";
import { recordLoginActivity } from "@/lib/loginStreak";
import { triggerMonsterEvolvedLog } from "@/lib/bulletinLog";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import { childUser, streak } from "../helpers/fixtures";

vi.mock("@/lib/bulletinLog", () => ({
  triggerMonsterEvolvedLog: vi.fn().mockResolvedValue(undefined),
  triggerBadgeLog: vi.fn().mockResolvedValue(undefined),
  triggerStreakTitleLog: vi.fn().mockResolvedValue(undefined),
}));

const mockTriggerMonsterEvolvedLog = vi.mocked(triggerMonsterEvolvedLog);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordLoginActivity", () => {
  const today = new Date("2026-03-29");

  it("初回ログインで loginCurrentStreak=1 になる", async () => {
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 0, loginBestStreak: 0, lastLoginDate: null }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());

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
      streak({ loginCurrentStreak: 3, loginBestStreak: 5, lastLoginDate: today }),
    );

    const result = await recordLoginActivity("child-1", today);

    expect(mockPrisma.streak.update).not.toHaveBeenCalled();
    expect(result.loginStreak).toBe(3);
    expect(result.bonusGranted).toBe(0);
  });

  it("昨日もログインしていれば連続日数が +1 になる", async () => {
    const yesterday = new Date("2026-03-28");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 5, loginBestStreak: 10, lastLoginDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());

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
      streak({ loginCurrentStreak: 10, loginBestStreak: 20, lastLoginDate: threeDaysAgo }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());

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
      streak({ loginCurrentStreak: 9, loginBestStreak: 9, lastLoginDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 1, evolutionPath: "STUDY", studyPt: 2, staminaPt: 2, lifePt: 2 }),
    );
    mockPrisma.user.update.mockResolvedValue(childUser());

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
      streak({ loginCurrentStreak: 19, loginBestStreak: 19, lastLoginDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 1, evolutionPath: "STUDY", studyPt: 3, staminaPt: 2, lifePt: 1 }),
    );
    mockPrisma.user.update.mockResolvedValue(childUser());

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
      streak({ loginCurrentStreak: 29, loginBestStreak: 29, lastLoginDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 1, evolutionPath: "STUDY", studyPt: 3, staminaPt: 1, lifePt: 2 }),
    );
    mockPrisma.user.update.mockResolvedValue(childUser());

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
      streak({ loginCurrentStreak: 8, loginBestStreak: 8, lastLoginDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());

    const result = await recordLoginActivity("child-1", today);

    expect(result.bonusGranted).toBe(0);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("rebirthPending中はボーナスでXPのみ加算し進化チェックをスキップ", async () => {
    const yesterday = new Date("2026-03-28");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 9, loginBestStreak: 9, lastLoginDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({
        evolutionStage: 3,
        evolutionPath: "STUDY_STAMINA_LIFE",
        studyPt: 15, staminaPt: 2, lifePt: 2,
        rebirthPending: true,
        collectedPaths: '["STUDY","STUDY_STAMINA","STUDY_STAMINA_LIFE"]',
      }),
    );
    mockPrisma.user.update.mockResolvedValue(childUser());

    const result = await recordLoginActivity("child-1", today);

    expect(result.bonusGranted).toBe(1);
    // XPのみ加算、進化関連フィールドなし（= rebirthPendingチェックが先に行われ
    // isReborn/rebirthEggBonus を使う進化チェック分岐がスキップされたことの確認）
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
      streak({ loginCurrentStreak: 9, loginBestStreak: 9, lastLoginDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());
    // stage1、9pt蓄積中。ボーナス1ptで total=10 → 10以上なので進化する
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({
        evolutionStage: 1,
        evolutionPath: "STUDY",
        studyPt: 4, staminaPt: 3, lifePt: 2,
        collectedPaths: '["STUDY"]',
        monsterLevels: "{}",
      }),
    );
    mockPrisma.user.update.mockResolvedValue(childUser());

    await recordLoginActivity("child-1", today);

    // isReborn（collectedPaths.length > 0）で進化した結果、collectedPaths/monsterLevels が更新されること
    const updateData = mockPrisma.user.update.mock.calls[0][0].data;
    expect(updateData).toHaveProperty("collectedPaths");
    expect(updateData).toHaveProperty("monsterLevels");
    expect(updateData.evolutionStage).toBe(2);

    vi.restoreAllMocks();
  });

  it("ボーナスで進化した場合、triggerMonsterEvolvedLog が呼ばれる（掲示板書き込み）", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // STUDY が選ばれる
    const yesterday = new Date("2026-03-28");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 9, loginBestStreak: 9, lastLoginDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({
        evolutionStage: 1,
        evolutionPath: "STUDY",
        studyPt: 4, staminaPt: 3, lifePt: 2,
        collectedPaths: '["STUDY"]',
        monsterLevels: "{}",
      }),
    );
    mockPrisma.user.update.mockResolvedValue(childUser());

    await recordLoginActivity("child-1", today);
    await new Promise((r) => setImmediate(r));

    expect(mockTriggerMonsterEvolvedLog).toHaveBeenCalledTimes(1);
    expect(mockTriggerMonsterEvolvedLog.mock.calls[0][0]).toBe("child-1");
    // 進化先のモンスター名 or パス文字列が渡されること
    expect(typeof mockTriggerMonsterEvolvedLog.mock.calls[0][1]).toBe("string");

    vi.restoreAllMocks();
  });

  it("ボーナスで進化しなかった場合、triggerMonsterEvolvedLog は呼ばれない", async () => {
    const yesterday = new Date("2026-03-28");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 9, loginBestStreak: 9, lastLoginDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());
    // 進化が発動しない範囲: stage1, 合計2+1=3pt < 10
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ evolutionStage: 1, evolutionPath: "STUDY", studyPt: 0, staminaPt: 1, lifePt: 1 }),
    );
    mockPrisma.user.update.mockResolvedValue(childUser());

    await recordLoginActivity("child-1", today);
    await new Promise((r) => setImmediate(r));

    expect(mockTriggerMonsterEvolvedLog).not.toHaveBeenCalled();
  });

  it("rebirthPending中のボーナスでは進化しないので triggerMonsterEvolvedLog は呼ばれない", async () => {
    const yesterday = new Date("2026-03-28");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 9, loginBestStreak: 9, lastLoginDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({
        evolutionStage: 3,
        evolutionPath: "STUDY_STAMINA_LIFE",
        studyPt: 15, staminaPt: 2, lifePt: 2,
        rebirthPending: true,
        collectedPaths: '["STUDY","STUDY_STAMINA","STUDY_STAMINA_LIFE"]',
      }),
    );
    mockPrisma.user.update.mockResolvedValue(childUser());

    await recordLoginActivity("child-1", today);
    await new Promise((r) => setImmediate(r));

    expect(mockTriggerMonsterEvolvedLog).not.toHaveBeenCalled();
  });

  // ─── Issue #93: monsterLevels のテーマ名前空間対応 ───────────────────
  // ログインストリークボーナスで stage3 に到達した際、monsterLevels が
  // "{monsterSetId}:{path}" 形式で保存されることを検証する。
  // 現状の loginStreak.ts は `monsterLevels[evolution.newPath] = ... + 1` と
  // 生キーで直書きしているため、これらのテストは Red（失敗）になる想定。
  describe("monsterLevels のテーマ名前空間対応（Issue #93）", () => {
    it("有料テーマ(buddha)でstage3到達時、monsterLevelsが'buddha:'名前空間付きキーで保存されること", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0); // STUDY が選ばれる
      const yesterday = new Date("2026-03-28");
      mockPrisma.streak.upsert.mockResolvedValue(
        streak({ loginCurrentStreak: 9, loginBestStreak: 9, lastLoginDate: yesterday }),
      );
      mockPrisma.streak.update.mockResolvedValue(streak());
      // stage2、29pt蓄積中。ボーナス1ptで total=30 → 30以上なので進化する
      mockPrisma.user.findUnique.mockResolvedValue(
        childUser({
          monsterSetId: "buddha",
          evolutionStage: 2,
          evolutionPath: "STUDY_STUDY",
          studyPt: 29, staminaPt: 0, lifePt: 0,
          collectedPaths: '["STUDY","STUDY_STUDY"]',
          // 旧形式の裸キーに既存値7がある（buddha は有料テーマなので引き継いではならない）
          monsterLevels: '{"STUDY_STUDY_STUDY":7}',
        }),
      );
      mockPrisma.user.update.mockResolvedValue(childUser());

      await recordLoginActivity("child-1", today);

      const updateData = mockPrisma.user.update.mock.calls[0][0].data;
      expect(updateData.evolutionStage).toBe(3);
      const levels = JSON.parse(updateData.monsterLevels as string) as Record<string, number>;
      expect(levels["buddha:STUDY_STUDY_STUDY"]).toBe(1);

      vi.restoreAllMocks();
    });

    it("無料テーマ(dark)は旧形式（裸のパス）の既存値を引き継いで+1すること", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0); // STUDY が選ばれる
      const yesterday = new Date("2026-03-28");
      mockPrisma.streak.upsert.mockResolvedValue(
        streak({ loginCurrentStreak: 9, loginBestStreak: 9, lastLoginDate: yesterday }),
      );
      mockPrisma.streak.update.mockResolvedValue(streak());
      mockPrisma.user.findUnique.mockResolvedValue(
        childUser({
          monsterSetId: "dark",
          evolutionStage: 2,
          evolutionPath: "STUDY_STUDY",
          studyPt: 29, staminaPt: 0, lifePt: 0,
          collectedPaths: '["STUDY","STUDY_STUDY"]',
          monsterLevels: '{"STUDY_STUDY_STUDY":3}',
        }),
      );
      mockPrisma.user.update.mockResolvedValue(childUser());

      await recordLoginActivity("child-1", today);

      const updateData = mockPrisma.user.update.mock.calls[0][0].data;
      const levels = JSON.parse(updateData.monsterLevels as string) as Record<string, number>;
      expect(levels["dark:STUDY_STUDY_STUDY"]).toBe(4);

      vi.restoreAllMocks();
    });
  });
});
