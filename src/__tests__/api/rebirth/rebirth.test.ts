import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/rebirth/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { childUser, parentUser } from "../../helpers/fixtures";
import { makeRequest } from "../../helpers/request";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

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
    } as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "child-1" },
        data: expect.objectContaining({
          rebirthPending: false,
          rebirthEggBonus: "STUDY",
          evolutionStage: 0,
          evolutionPath: "",
          studyPt: 0,
          staminaPt: 0,
          lifePt: 0,
        }),
      }),
    );
  });

  it("有効なeggType(STAMINA)でrebirthを実行すること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...childUser({ id: "child-1" }),
      rebirthPending: true,
    } as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    const req = makeRequest("/api/rebirth", { eggType: "STAMINA" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
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
    } as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    const req = makeRequest("/api/rebirth", { eggType: "LIFE" });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
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
    } as any);
    mockPrisma.user.update.mockResolvedValue({} as any);
    
    const req = makeRequest("/api/rebirth", { eggType: "NORMAL" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rebirthEggBonus: null }),
      }),
    );
  });

  it("成功時に{ ok: true }を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockPrisma.user.findUnique.mockResolvedValue({
      ...childUser({ id: "child-1" }),
      rebirthPending: true,
    } as any);
    mockPrisma.user.update.mockResolvedValue({} as any);

    const req = makeRequest("/api/rebirth", { eggType: "STUDY" });
    const res = await POST(req);
    const json = await res.json();
    expect(json).toEqual({ ok: true });
  });
});
