// Issue #85: 親画面からモンスターテーマの付与・切替を行う（モンスターテーマセット Stage2）
// 対象: src/app/api/family/members/[id]/monster-theme/route.ts の PATCH (未実装。実装は implementer が行う)
//
// 仕様:
//  - PARENT 認証必須。対象 child が自ファミリーであることを確認する（他ファミリーなら403）
//  - themeId が @/lib/monsterThemes/index の MONSTER_THEMES に存在しない場合400
//  - 即時反映条件（evolutionStage === 0 または rebirthPending === true）を満たす場合:
//    monsterSetId を更新し、activateChildTheme(childId, themeId, "manual") を呼ぶ
//    （pendingMonsterSetId は変更しない）
//  - 満たさない場合: pendingMonsterSetId にのみ保存する（activateChildTheme は呼ばない、
//    monsterSetId 自体も変更しない）

import { describe, it, expect, vi, beforeEach } from "vitest";
import { PATCH } from "@/app/api/family/members/[id]/monster-theme/route";
import { getCurrentUser } from "@/lib/auth";
import { activateChildTheme } from "@/lib/monsterThemes";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { makeParams, makeRequest } from "../../helpers/request";
import { parentUserWithFamily, childUserWithFamily, childUser } from "../../helpers/fixtures";

vi.mock("@/lib/monsterThemes", () => ({
  activateChildTheme: vi.fn().mockResolvedValue(undefined),
}));

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockActivateChildTheme = vi.mocked(activateChildTheme);

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
    expect(mockActivateChildTheme).not.toHaveBeenCalled();
  });

  it("存在しないテーマidの場合400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1", evolutionStage: 0 }));

    const res = await PATCH(patchRequest("nonexistent-theme"), makeParams("child-1"));
    expect(res.status).toBe(400);
    expect(mockActivateChildTheme).not.toHaveBeenCalled();
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("themeIdが未指定の場合400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1", evolutionStage: 0 }));

    const res = await PATCH(patchRequest(undefined), makeParams("child-1"));
    expect(res.status).toBe(400);
  });

  it("卵(evolutionStage===0)のとき即時切替: monsterSetIdが更新されactivateChildThemeが呼ばれること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", evolutionStage: 0, rebirthPending: false }),
    );
    mockPrisma.user.update.mockResolvedValue(childUser({ id: "child-1", monsterSetId: "buddha" }));

    const res = await PATCH(patchRequest("buddha"), makeParams("child-1"));
    expect(res.status).toBe(200);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "child-1" },
        data: expect.objectContaining({ monsterSetId: "buddha" }),
      }),
    );
    // pendingMonsterSetId は変更しない
    const updateCall = mockPrisma.user.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateCall.data).not.toHaveProperty("pendingMonsterSetId");

    expect(mockActivateChildTheme).toHaveBeenCalledWith("child-1", "buddha", "manual");
  });

  it("rebirthPending===trueのとき即時切替されること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", evolutionStage: 3, rebirthPending: true }),
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
    expect(mockActivateChildTheme).toHaveBeenCalledWith("child-1", "light", "manual");
  });

  it("育成途中(evolutionStage>0 かつ rebirthPending!==true)のときpendingMonsterSetIdにのみ保存されること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({ id: "child-1", evolutionStage: 2, rebirthPending: false }),
    );
    mockPrisma.user.update.mockResolvedValue(
      childUser({ id: "child-1", pendingMonsterSetId: "buddha" }),
    );

    const res = await PATCH(patchRequest("buddha"), makeParams("child-1"));
    expect(res.status).toBe(200);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "child-1" },
      data: { pendingMonsterSetId: "buddha" },
    });
    expect(mockActivateChildTheme).not.toHaveBeenCalled();
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
    expect(mockActivateChildTheme).not.toHaveBeenCalled();
  });
});
