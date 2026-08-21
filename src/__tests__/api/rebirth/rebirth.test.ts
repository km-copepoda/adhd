import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/rebirth/route";
import { getCurrentUser } from "@/lib/auth";
import { checkAndUnlockBadges } from "@/lib/badges";
import { triggerBadgeLog } from "@/lib/bulletinLog";
import { activateFamilyTheme } from "@/lib/monsterThemes";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { childUser, childUserWithFamily, parentUserWithFamily } from "../../helpers/fixtures";
import { makeRequest } from "../../helpers/request";

vi.mock("@/lib/badges", async () => {
  const actual = await vi.importActual<typeof import("@/lib/badges")>("@/lib/badges");
  return {
    ...actual,
    checkAndUnlockBadges: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@/lib/bulletinLog", async () => {
  const actual = await vi.importActual<typeof import("@/lib/bulletinLog")>("@/lib/bulletinLog");
  return {
    ...actual,
    triggerBadgeLog: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/lib/monsterThemes", () => ({
  activateFamilyTheme: vi.fn().mockResolvedValue(undefined),
}));

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockCheckAndUnlockBadges = vi.mocked(checkAndUnlockBadges);
const mockTriggerBadgeLog = vi.mocked(triggerBadgeLog);
const mockActivateFamilyTheme = vi.mocked(activateFamilyTheme);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/rebirth", () => {
  it("未認証の場合、401を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("PARENTロールでは403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("rebirthPendingがfalseの場合400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ id: "child-1", rebirthPending: false }),
    );
    const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("無効なeggTypeの場合400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.user.findUnique.mockResolvedValue(childUser({ id: "child-1", rebirthPending: true }));
    const req = makeRequest("/api/rebirth", { eggType: "INVALID" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("有効なeggType(STUDY)でrebirthを実行しstage/ptsをリセットすること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ id: "child-1", rebirthPending: true, usedEggBonuses: "[]" }),
    );
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "child-1", rebirthPending: true },
        data: expect.objectContaining({
          rebirthPending: false,
          rebirthEggBonus: "STUDY",
          evolutionStage: 0,
          evolutionPath: "",
          studyPt: 0,
          staminaPt: 0,
          lifePt: 0,
          usedEggBonuses: '["STUDY"]',
        }),
      }),
    );
  });

  it("既にSTUDYを使用済みの場合、usedEggBonusesに重複追加しないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ id: "child-1", rebirthPending: true, usedEggBonuses: '["STUDY"]' }),
    );
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ usedEggBonuses: '["STUDY"]' }),
      }),
    );
  });

  it("NORMALの場合、usedEggBonusesを変更しないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ id: "child-1", rebirthPending: true, usedEggBonuses: '["STUDY"]' }),
    );
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const req = makeRequest("/api/rebirth", { eggType: "NORMAL" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ usedEggBonuses: '["STUDY"]' }),
      }),
    );
  });

  it("有効なeggType(STAMINA)でrebirthを実行すること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ id: "child-1", rebirthPending: true, usedEggBonuses: "[]" }),
    );
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const req = makeRequest("/api/rebirth", { eggType: "STAMINA" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rebirthEggBonus: "STAMINA" }),
      }),
    );
  });

  it("有効なeggType(LIFE)でrebirthを実行すること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ id: "child-1", rebirthPending: true, usedEggBonuses: "[]" }),
    );
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const req = makeRequest("/api/rebirth", { eggType: "LIFE" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rebirthEggBonus: "LIFE" }),
      }),
    );
  });

  it("有効なeggType(NORMAL)でrebirthを実行しrebirthEggBonusがnullになること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ id: "child-1", rebirthPending: true, usedEggBonuses: "[]" }),
    );
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const req = makeRequest("/api/rebirth", { eggType: "NORMAL" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rebirthEggBonus: null }),
      }),
    );
  });

  it("rebirthPending=trueで読み込んだ後、update時には他経路で既に転生済み(count=0)の場合は400を返すこと（TOCTOUレース）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ id: "child-1", rebirthPending: true, usedEggBonuses: "[]" }),
    );
    // updateMany が 0 件マッチ = 既に別経路（親代理 or 別端末）で転生済み
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });

    const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("成功時に{ ok: true }を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ id: "child-1", rebirthPending: true, usedEggBonuses: "[]" }),
    );
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
    const res = await POST(req);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });

  it("転生成功時に checkAndUnlockBadges を呼ぶ（rebirth_egg_used 即時解錠）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ id: "child-1", rebirthPending: true, usedEggBonuses: "[]" }),
    );
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

    const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    await new Promise(r => setImmediate(r));

    expect(mockCheckAndUnlockBadges).toHaveBeenCalledWith("child-1");
  });

  it("新規解錠バッジを掲示板に流す（triggerBadgeLog 呼び出し）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ id: "child-1", rebirthPending: true, usedEggBonuses: "[]" }),
    );
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
    mockCheckAndUnlockBadges.mockResolvedValue([
      { id: "rebirth_egg_used", name: "卵えらびマスター", emoji: "🥚", description: "..." },
    ]);

    const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
    await POST(req);
    await new Promise(r => setImmediate(r));

    expect(mockTriggerBadgeLog).toHaveBeenCalledWith("child-1", "卵えらびマスター");
  });

  // Issue #85 / #111: 転生実行時に pendingMonsterSetId を monsterSetId へ反映する。
  // モンスターテーマの所持記録は家族単位（FamilyMonsterTheme）で行うため、
  // activateFamilyTheme は childId ではなく子供が所属する家族の familyId で呼ばれる。
  describe("pendingMonsterSetId の反映（モンスターテーマセット Stage2、家族単位所持へ移行）", () => {
    it("pendingMonsterSetIdが設定されている場合、monsterSetIdに反映されpendingMonsterSetIdがクリアされること", async () => {
      mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
      mockPrisma.user.findUnique.mockResolvedValue(
        childUser({
          id: "child-1",
          familyId: "fam-1",
          rebirthPending: true,
          usedEggBonuses: "[]",
          pendingMonsterSetId: "buddha",
        }),
      );
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

      const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
      const res = await POST(req);
      expect(res.status).toBe(200);

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "child-1", rebirthPending: true },
          data: expect.objectContaining({
            monsterSetId: "buddha",
            pendingMonsterSetId: null,
          }),
        }),
      );
    });

    it("pendingMonsterSetIdが設定されている場合、activateFamilyThemeが子供の所属するfamilyIdで呼ばれること", async () => {
      mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
      mockPrisma.user.findUnique.mockResolvedValue(
        childUser({
          id: "child-1",
          familyId: "fam-1",
          rebirthPending: true,
          usedEggBonuses: "[]",
          pendingMonsterSetId: "buddha",
        }),
      );
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

      const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
      const res = await POST(req);
      expect(res.status).toBe(200);
      await new Promise(r => setImmediate(r));

      // childId ("child-1") ではなく familyId ("fam-1") が渡ること
      expect(mockActivateFamilyTheme).toHaveBeenCalledWith("fam-1", "buddha", "manual");
    });

    it("pendingMonsterSetIdが未設定(null)の場合、monsterSetId/pendingMonsterSetIdを変更しないこと", async () => {
      mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
      mockPrisma.user.findUnique.mockResolvedValue(
        childUser({
          id: "child-1",
          familyId: "fam-1",
          rebirthPending: true,
          usedEggBonuses: "[]",
          pendingMonsterSetId: null,
        }),
      );
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

      const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
      const res = await POST(req);
      expect(res.status).toBe(200);

      const updateCall = mockPrisma.user.updateMany.mock.calls[0][0] as { data: Record<string, unknown> };
      expect(updateCall.data).not.toHaveProperty("monsterSetId");
      expect(updateCall.data).not.toHaveProperty("pendingMonsterSetId");
    });

    it("pendingMonsterSetIdが未設定(null)の場合、activateFamilyThemeが呼ばれないこと", async () => {
      mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
      mockPrisma.user.findUnique.mockResolvedValue(
        childUser({
          id: "child-1",
          familyId: "fam-1",
          rebirthPending: true,
          usedEggBonuses: "[]",
          pendingMonsterSetId: null,
        }),
      );
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

      const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
      const res = await POST(req);
      expect(res.status).toBe(200);
      await new Promise(r => setImmediate(r));

      expect(mockActivateFamilyTheme).not.toHaveBeenCalled();
    });

    it("境界値: familyIdがnullの子供の場合、activateFamilyThemeを呼ばず、転生処理自体は成功すること（after()内で例外を出さない）", async () => {
      mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
      mockPrisma.user.findUnique.mockResolvedValue(
        childUser({
          id: "child-1",
          familyId: null,
          rebirthPending: true,
          usedEggBonuses: "[]",
          pendingMonsterSetId: "buddha",
        }),
      );
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });

      const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ ok: true });
      await new Promise(r => setImmediate(r));

      expect(mockActivateFamilyTheme).not.toHaveBeenCalled();
    });
  });
});
