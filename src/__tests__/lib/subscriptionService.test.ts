import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getSubscription,
  getUserPlan,
} from "@/lib/subscriptionService";

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSubscription", () => {
  it("レコードが無い場合は null", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    const sub = await getSubscription("user-1");

    expect(sub).toBeNull();
    expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
  });

  it("レコードがあればそのまま返す", async () => {
    const row = {
      id: "sub-1",
      userId: "user-1",
      plan: "PREMIUM" as const,
      platform: "web",
      externalId: "cus_xxx",
      currentPeriodEnd: new Date("2026-09-06"),
      canceledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockPrisma.subscription.findUnique.mockResolvedValue(row as never);

    const sub = await getSubscription("user-1");
    expect(sub).toEqual(row);
  });
});

describe("getUserPlan", () => {
  const now = new Date("2026-08-06T00:00:00Z");

  it("Subscription レコードが無い → FREE", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    const plan = await getUserPlan("user-1", now);

    expect(plan).toBe("FREE");
  });

  it("plan=FREE のレコード → FREE", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "FREE",
      currentPeriodEnd: null,
    } as never);

    const plan = await getUserPlan("user-1", now);
    expect(plan).toBe("FREE");
  });

  it("plan=PREMIUM で期間有効 → PREMIUM", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "PREMIUM",
      currentPeriodEnd: new Date("2026-09-06"),
    } as never);

    const plan = await getUserPlan("user-1", now);
    expect(plan).toBe("PREMIUM");
  });

  it("plan=PREMIUM で期間切れ → FREE (grace period なし)", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "PREMIUM",
      currentPeriodEnd: new Date("2026-07-01"),
    } as never);

    const plan = await getUserPlan("user-1", now);
    expect(plan).toBe("FREE");
  });

  it("plan=PREMIUM で currentPeriodEnd=null は PREMIUM (無期限扱い、手動付与など)", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "PREMIUM",
      currentPeriodEnd: null,
    } as never);

    const plan = await getUserPlan("user-1", now);
    expect(plan).toBe("PREMIUM");
  });
});
