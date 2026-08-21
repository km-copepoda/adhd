// Issue #85 / #90 / #111: 親画面からモンスターテーマの付与・切替を行う（モンスターテーマセット Stage2/3、家族単位所持へ移行）
// 対象: src/app/api/family/members/[id]/monster-theme/route.ts の PATCH (家族単位の所持チェックは未実装。実装は implementer が行う)
//
// 仕様（Issue #111 更新後）:
//  - PARENT 認証必須。対象 child が自ファミリーであることを確認する（他ファミリーなら403）
//  - themeId が @/lib/monsterThemes/index の MONSTER_THEMES に存在しない場合400
//  - themeId が存在していても isFree: false（現状 buddha）の場合:
//    prisma.familyMonsterTheme.findUnique({ where: { familyId_themeId: { familyId: user.familyId, themeId } } })
//    で「家族単位」のレコードの有無を確認する（childId ではなく親の familyId で判定する）
//      - レコードが無ければ400（決済導線は未実装だが、開発者による手動DB挿入で
//        「購入済み」として付与された家族は選択できる。Issue #90 / #111）
//      - レコードがあれば、以降は isFree:true のテーマと同じ即時反映/予約ロジックに進む
//      - 同一家族内の兄弟間でテーマ所持は共有される（どちらの子IDを指定しても同じ判定になる）
//  - isFree: true のテーマは所持レコードの有無に関わらず選択できる
//    （familyMonsterTheme.findUnique は呼ばれない）
//  - 即時反映条件（evolutionStage === 0 または rebirthPending === true）を満たす場合:
//    monsterSetId を更新し、activateFamilyTheme(user.familyId, themeId, "manual") を呼ぶ
//    （pendingMonsterSetId は変更しない。childId ではなく親の familyId を渡す）
//  - 満たさない場合: pendingMonsterSetId にのみ保存する（activateFamilyTheme は呼ばない、
//    monsterSetId 自体も変更しない）

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "@/app/api/family/members/[id]/monster-theme/route";
import { getCurrentUser } from "@/lib/auth";
import { activateFamilyTheme } from "@/lib/monsterThemes";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { makeParams, makeRequest } from "../../helpers/request";
import { parentUserWithFamily, childUserWithFamily, childUser } from "../../helpers/fixtures";

vi.mock("@/lib/monsterThemes", () => ({
  activateFamilyTheme: vi.fn().mockResolvedValue(undefined),
}));

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockActivateFamilyTheme = vi.mocked(activateFamilyTheme);

/** FamilyMonsterTheme の所持レコード（購入済み扱い）を模したフィクスチャ */
function ownedThemeRecord(overrides?: { familyId?: string; themeId?: string }) {
  return {
    id: "fmt-1",
    familyId: overrides?.familyId ?? "fam-1",
    themeId: overrides?.themeId ?? "buddha",
    activatedAt: new Date("2026-01-01T00:00:00Z"),
    grantReason: "purchase",
  };
}

function patchRequest(themeId: unknown) {
  return makeRequest("/api/family/members/child-1/monster-theme", { themeId }, "PATCH");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PATCH /api/family/members/[id]/monster-theme", () => {
  it("未認証の場合、401を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await PATCH(patchRequest("light"), makeParams("child-1"));
    expect(res.status).toBe(401);
  });

  it("CHILDロールの場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await PATCH(patchRequest("light"), makeParams("child-1"));
    expect(res.status).toBe(403);
  });

  it("他ファミリーの子には403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-1" }));
    // findFirst は familyId 条件でマッチしないため null を返す想定
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await PATCH(patchRequest("light"), makeParams("child-other-family"));
    expect(res.status).toBe(403);
    expect(mockActivateFamilyTheme).not.toHaveBeenCalled();
  });

  it("存在しないテーマidの場合400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1", evolutionStage: 0 }));

    const res = await PATCH(patchRequest("nonexistent-theme"), makeParams("child-1"));
    expect(res.status).toBe(400);
    expect(mockActivateFamilyTheme).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("themeIdが未指定の場合400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1", evolutionStage: 0 }));

    const res = await PATCH(patchRequest(undefined), makeParams("child-1"));
    expect(res.status).toBe(400);
  });

  it("卵(evolutionStage===0)のとき即時切替: monsterSetIdが更新されactivateFamilyThemeが親のfamilyIdで呼ばれること", async () => {
    // NOTE: buddha は isFree:false のため所持チェックが必要。即時切替ロジック自体の
    // 検証が目的なので無料テーマ(light)で代替する。
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-1" }));
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", evolutionStage: 0, rebirthPending: false, familyId: "fam-1" }),
    );
    mockPrisma.user.update.mockResolvedValue(childUser({ id: "child-1", monsterSetId: "light" }));

    const res = await PATCH(patchRequest("light"), makeParams("child-1"));
    expect(res.status).toBe(200);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "child-1" },
        data: expect.objectContaining({ monsterSetId: "light" }),
      }),
    );
    // pendingMonsterSetId は変更しない
    const updateCall = mockPrisma.user.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateCall.data).not.toHaveProperty("pendingMonsterSetId");

    // childId ではなく親の familyId が渡ること
    expect(mockActivateFamilyTheme).toHaveBeenCalledWith("fam-1", "light", "manual");
  });

  it("rebirthPending===trueのとき即時切替されること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-1" }));
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", evolutionStage: 3, rebirthPending: true, familyId: "fam-1" }),
    );
    mockPrisma.user.update.mockResolvedValue(childUser({ id: "child-1", monsterSetId: "light" }));

    const res = await PATCH(patchRequest("light"), makeParams("child-1"));
    expect(res.status).toBe(200);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "child-1" },
        data: expect.objectContaining({ monsterSetId: "light" }),
      }),
    );
    expect(mockActivateFamilyTheme).toHaveBeenCalledWith("fam-1", "light", "manual");
  });

  it("育成途中(evolutionStage>0 かつ rebirthPending!==true)のときpendingMonsterSetIdにのみ保存されること", async () => {
    // NOTE: buddha は isFree:false のため所持チェックが必要。予約ロジック自体の
    // 検証が目的なので無料テーマ(light)で代替する。
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", evolutionStage: 2, rebirthPending: false }),
    );
    mockPrisma.user.update.mockResolvedValue(
      childUser({ id: "child-1", pendingMonsterSetId: "light" }),
    );

    const res = await PATCH(patchRequest("light"), makeParams("child-1"));
    expect(res.status).toBe(200);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { pendingMonsterSetId: "light" },
    });
    expect(mockActivateFamilyTheme).not.toHaveBeenCalled();
  });

  describe("有料テーマ（isFree: false）の家族単位所持チェック（Issue #111: 兄弟共有）", () => {
    it("FamilyMonsterThemeにbuddhaのレコードが無い場合、400を返すこと（即時反映条件を満たす卵状態でも拒否されること）", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-1" }));
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", evolutionStage: 0, rebirthPending: false, familyId: "fam-1" }),
      );
      mockPrisma.familyMonsterTheme.findUnique.mockResolvedValue(null);

      const res = await PATCH(patchRequest("buddha"), makeParams("child-1"));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBeTruthy();
      expect(body.error).toBe("このテーマはまだ購入されていません");

      expect(mockPrisma.familyMonsterTheme.findUnique).toHaveBeenCalledWith({
        where: { familyId_themeId: { familyId: "fam-1", themeId: "buddha" } },
      });
      // childId ではなく親の familyId で判定すること
      expect(mockPrisma.familyMonsterTheme.findUnique).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { childId_themeId: expect.anything() },
        }),
      );
    });

    it("FamilyMonsterThemeにbuddhaのレコードが無い場合、monsterSetId/pendingMonsterSetIdのいずれも変更されず、activateFamilyThemeも呼ばれないこと", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", evolutionStage: 2, rebirthPending: false }),
      );
      mockPrisma.familyMonsterTheme.findUnique.mockResolvedValue(null);

      const res = await PATCH(patchRequest("buddha"), makeParams("child-1"));
      expect(res.status).toBe(400);
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockActivateFamilyTheme).not.toHaveBeenCalled();
    });

    it("FamilyMonsterThemeにbuddhaのレコードがある場合、即時反映条件（卵）を満たすと切替が成功すること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-1" }));
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", evolutionStage: 0, rebirthPending: false, familyId: "fam-1" }),
      );
      mockPrisma.familyMonsterTheme.findUnique.mockResolvedValue(ownedThemeRecord());
      mockPrisma.user.update.mockResolvedValue(childUser({ id: "child-1", monsterSetId: "buddha" }));

      const res = await PATCH(patchRequest("buddha"), makeParams("child-1"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ immediate: true, monsterSetId: "buddha" });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "child-1" },
          data: expect.objectContaining({ monsterSetId: "buddha" }),
        }),
      );
      expect(mockActivateFamilyTheme).toHaveBeenCalledWith("fam-1", "buddha", "manual");
    });

    it("FamilyMonsterThemeにbuddhaのレコードがある場合、育成途中(予約条件)ではpendingMonsterSetIdに保存されること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", evolutionStage: 2, rebirthPending: false }),
      );
      mockPrisma.familyMonsterTheme.findUnique.mockResolvedValue(ownedThemeRecord());
      mockPrisma.user.update.mockResolvedValue(
        childUser({ id: "child-1", pendingMonsterSetId: "buddha" }),
      );

      const res = await PATCH(patchRequest("buddha"), makeParams("child-1"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ immediate: false, pendingMonsterSetId: "buddha" });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "child-1" },
        data: { pendingMonsterSetId: "buddha" },
      });
      expect(mockActivateFamilyTheme).not.toHaveBeenCalled();
    });

    it("境界値: isFree:trueのテーマ(dark/light)は所持レコード無しでも従来通り成功すること（回帰確認）", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
      mockPrisma.user.findFirst.mockResolvedValue(
        childUser({ id: "child-1", evolutionStage: 0, rebirthPending: false }),
      );
      mockPrisma.user.update.mockResolvedValue(childUser({ id: "child-1", monsterSetId: "dark" }));

      const res = await PATCH(patchRequest("dark"), makeParams("child-1"));
      expect(res.status).toBe(200);
      expect(mockActivateFamilyTheme).toHaveBeenCalledWith("fam-1", "dark", "manual");
      // isFree:true のテーマでは所持チェックを行わない
      expect(mockPrisma.familyMonsterTheme.findUnique).not.toHaveBeenCalled();
    });

    it("兄弟共有: 家族がbuddhaを所持していれば、子供Aを指定した場合も子供Bを指定した場合も200で切り替えられること", async () => {
      mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: "fam-shared" }));
      mockPrisma.familyMonsterTheme.findUnique.mockResolvedValue(
        ownedThemeRecord({ familyId: "fam-shared" }),
      );

      // 子供A
      mockPrisma.user.findFirst.mockResolvedValueOnce(
        childUser({ id: "child-a", evolutionStage: 0, rebirthPending: false, familyId: "fam-shared" }),
      );
      mockPrisma.user.update.mockResolvedValueOnce(
        childUser({ id: "child-a", monsterSetId: "buddha" }),
      );
      const resA = await PATCH(patchRequest("buddha"), makeParams("child-a"));
      expect(resA.status).toBe(200);

      // 子供B（別の子供IDだが同じ家族。所持チェックは家族単位なので同じレコードで通ること）
      mockPrisma.user.findFirst.mockResolvedValueOnce(
        childUser({ id: "child-b", evolutionStage: 0, rebirthPending: false, familyId: "fam-shared" }),
      );
      mockPrisma.user.update.mockResolvedValueOnce(
        childUser({ id: "child-b", monsterSetId: "buddha" }),
      );
      const resB = await PATCH(
        makeRequest("/api/family/members/child-b/monster-theme", { themeId: "buddha" }, "PATCH"),
        makeParams("child-b"),
      );
      expect(resB.status).toBe(200);

      expect(mockActivateFamilyTheme).toHaveBeenCalledWith("fam-shared", "buddha", "manual");
      expect(mockActivateFamilyTheme).toHaveBeenCalledTimes(2);
      // 所持チェックは常に family 単位の同じ where で呼ばれる（子供IDに依存しない）
      for (const call of mockPrisma.familyMonsterTheme.findUnique.mock.calls) {
        expect(call[0]).toEqual({
          where: { familyId_themeId: { familyId: "fam-shared", themeId: "buddha" } },
        });
      }
    });
  });

  it("境界値: evolutionStage===1（進化直後、卵ではない最小値）で予約扱いになること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", evolutionStage: 1, rebirthPending: false }),
    );
    mockPrisma.user.update.mockResolvedValue(
      childUser({ id: "child-1", pendingMonsterSetId: "dark" }),
    );

    const res = await PATCH(patchRequest("dark"), makeParams("child-1"));
    expect(res.status).toBe(200);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { pendingMonsterSetId: "dark" },
    });
    expect(mockActivateFamilyTheme).not.toHaveBeenCalled();
  });
});
