import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/subscription/limits/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parentUser, childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

/// GET /api/subscription/limits (PARENT 専用)
/// preempt チェック用の軽量エンドポイント。プランに基づく上限値のみ返し、
/// usage カウントは含めない (プラン画面用のフルデータは /status を使う)。
/// N+1 (家族の子人数 × 2 count クエリ) を避けるために /status を叩かない用途で用意。
describe("GET /api/subscription/limits", () => {
  it("未認証は 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("CHILD は 403", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("PARENT + Subscription 無し → FREE の LIMITS", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ task: 10, treasure_item: 5, child: 1 });
    expect(json).not.toHaveProperty("plan"); // プラン画面は /status を使う分離
    expect(json).not.toHaveProperty("usage"); // usage は返さない (軽量)
    // DB クエリは Subscription 1 本のみ。usage 系 (findMany/count) は呼ばない
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.taskTemplate.count).not.toHaveBeenCalled();
    expect(mockPrisma.treasureItem.count).not.toHaveBeenCalled();
  });

  it("PARENT + PREMIUM 有効 → 全 null (無制限)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "PREMIUM",
      currentPeriodEnd: new Date("2099-12-31"),
    } as never);

    const res = await GET();
    const json = await res.json();
    expect(json).toEqual({ task: null, treasure_item: null, child: null });
  });

  it("familyId=null (単独モード PARENT) は FREE の LIMITS 固定", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as never);
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "PREMIUM",
      currentPeriodEnd: new Date("2099-12-31"),
    } as never);

    const res = await GET();
    const json = await res.json();
    expect(json).toEqual({ task: 10, treasure_item: 5, child: 1 });
  });
});
