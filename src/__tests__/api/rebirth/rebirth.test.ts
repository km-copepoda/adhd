import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/rebirth/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkAndUnlockBadges } from "@/lib/badges";
import { triggerBadgeLog } from "@/lib/bulletinLog";
import { childUser, parentUser } from "../../helpers/fixtures";
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

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockCheckAndUnlockBadges = vi.mocked(checkAndUnlockBadges);
const mockTriggerBadgeLog = vi.mocked(triggerBadgeLog);

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
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("rebirthPendingがfalseの場合400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...childUser(),
      rebirthPending: false,
    } as any);
    const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("無効なeggTypeの場合400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...childUser(),
      rebirthPending: true,
    } as any);
    const req = makeRequest("/api/rebirth", { eggType: "INVALID" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("有効なeggType(STUDY)でrebirthを実行しstage/ptsをリセットすること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...childUser({ id: "child-1" }),
      rebirthPending: true,
      usedEggBonuses: "[]",
    } as any);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 } as any);

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
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...childUser({ id: "child-1" }),
      rebirthPending: true,
      usedEggBonuses: '["STUDY"]',
    } as any);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 } as any);

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
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...childUser({ id: "child-1" }),
      rebirthPending: true,
      usedEggBonuses: '["STUDY"]',
    } as any);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 } as any);

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
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...childUser({ id: "child-1" }),
      rebirthPending: true,
      usedEggBonuses: "[]",
    } as any);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 } as any);

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
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...childUser({ id: "child-1" }),
      rebirthPending: true,
      usedEggBonuses: "[]",
    } as any);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 } as any);

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
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...childUser({ id: "child-1" }),
      rebirthPending: true,
      usedEggBonuses: "[]",
    } as any);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 } as any);
    
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
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...childUser({ id: "child-1" }),
      rebirthPending: true,
      usedEggBonuses: "[]",
    } as any);
    // updateMany が 0 件マッチ = 既に別経路（親代理 or 別端末）で転生済み
    mockPrisma.user.updateMany.mockResolvedValue({ count: 0 } as any);

    const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("成功時に{ ok: true }を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...childUser({ id: "child-1" }),
      rebirthPending: true,
      usedEggBonuses: "[]",
    } as any);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 } as any);

    const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
    const res = await POST(req);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });

  it("転生成功時に checkAndUnlockBadges を呼ぶ（rebirth_egg_used 即時解錠）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...childUser({ id: "child-1" }),
      rebirthPending: true,
      usedEggBonuses: "[]",
    } as any);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 } as any);

    const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    await new Promise(r => setImmediate(r));

    expect(mockCheckAndUnlockBadges).toHaveBeenCalledWith("child-1");
  });

  it("新規解錠バッジを掲示板に流す（triggerBadgeLog 呼び出し）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...childUser({ id: "child-1" }),
      rebirthPending: true,
      usedEggBonuses: "[]",
    } as any);
    mockPrisma.user.updateMany.mockResolvedValue({ count: 1 } as any);
    mockCheckAndUnlockBadges.mockResolvedValue([
      { id: "rebirth_egg_used", name: "卵えらびマスター", emoji: "🥚", description: "..." },
    ]);

    const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
    await POST(req);
    await new Promise(r => setImmediate(r));

    expect(mockTriggerBadgeLog).toHaveBeenCalledWith("child-1", "卵えらびマスター");
  });
});
