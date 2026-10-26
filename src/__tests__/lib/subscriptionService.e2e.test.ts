import { describe, it, expect, vi, beforeEach } from "vitest";
import { grantPremiumForE2E, cancelE2ePremium } from "@/lib/subscriptionService";
import { hasBlockingSubscription } from "@/lib/accountDeletion.data";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import { subscription } from "../helpers/fixtures";

const NOW = new Date("2026-05-01T00:00:00.000Z");

function p2002() {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

function expectNoUnconditionalWrites() {
  expect(mockPrisma.subscription.update).not.toHaveBeenCalled();
  expect(mockPrisma.subscription.upsert).not.toHaveBeenCalled();
  expect(mockPrisma.subscription.delete).not.toHaveBeenCalled();
  expect(mockPrisma.subscription.deleteMany).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("grantPremiumForE2E", () => {
  it("E2E行がある場合: platform=E2E を条件に付け直し(canceledAtをnullに戻す)、createせず granted", async () => {
    mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });

    const res = await grantPremiumForE2E("parent-1");

    expect(res).toEqual({ status: "granted" });
    expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
      where: { userId: "parent-1", platform: "E2E" },
      data: { plan: "PREMIUM", currentPeriodEnd: null, canceledAt: null },
    });
    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
    expectNoUnconditionalWrites();
  });

  it("行が無い場合: platform=E2E で create し granted", async () => {
    mockPrisma.subscription.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.subscription.create.mockResolvedValue(
      subscription({ userId: "parent-1", plan: "PREMIUM", platform: "E2E" }),
    );

    const res = await grantPremiumForE2E("parent-1");

    expect(res).toEqual({ status: "granted" });
    expect(mockPrisma.subscription.create).toHaveBeenCalledWith({
      data: { userId: "parent-1", plan: "PREMIUM", currentPeriodEnd: null, platform: "E2E" },
    });
    expectNoUnconditionalWrites();
  });

  it.each([
    ["platform が null", { platform: null }],
    ["platform が STRIPE", { platform: "STRIPE" }],
    ["externalId あり", { platform: "STRIPE", externalId: "ext-1" }],
    ["期限付きPREMIUM", { plan: "PREMIUM" as const, currentPeriodEnd: new Date("2027-01-01") }],
    ["canceledAt あり", { plan: "PREMIUM" as const, canceledAt: new Date("2026-04-01") }],
  ])("一般行(%s)がある場合: 書き換えず not_eligible", async () => {
    // 印のない行は updateMany(platform=E2E) に一致せず、create は unique 制約で失敗する
    mockPrisma.subscription.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.subscription.create.mockRejectedValue(p2002());

    const res = await grantPremiumForE2E("parent-1");

    expect(res).toEqual({ status: "not_eligible" });
    // 全ての updateMany は platform: "E2E" を条件に含む（一般行に届かない）
    for (const [arg] of mockPrisma.subscription.updateMany.mock.calls) {
      expect(arg).toMatchObject({ where: { userId: "parent-1", platform: "E2E" } });
    }
    expectNoUnconditionalWrites();
  });

  it("P2002 の後に updateMany を再実行し、1件なら granted（同時実行の競合）", async () => {
    mockPrisma.subscription.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    mockPrisma.subscription.create.mockRejectedValue(p2002());

    const res = await grantPremiumForE2E("parent-1");

    expect(res).toEqual({ status: "granted" });
    expect(mockPrisma.subscription.updateMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.subscription.updateMany).toHaveBeenNthCalledWith(2, {
      where: { userId: "parent-1", platform: "E2E" },
      data: { plan: "PREMIUM", currentPeriodEnd: null, canceledAt: null },
    });
  });

  it("P2002 の後の updateMany も0件なら not_eligible", async () => {
    mockPrisma.subscription.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.subscription.create.mockRejectedValue(p2002());

    const res = await grantPremiumForE2E("parent-1");

    expect(res).toEqual({ status: "not_eligible" });
    expect(mockPrisma.subscription.updateMany).toHaveBeenCalledTimes(2);
  });

  it("P2002 以外の create 例外はそのまま投げる（updateMany の再実行もしない）", async () => {
    const err = Object.assign(new Error("connection lost"), { code: "P1001" });
    mockPrisma.subscription.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.subscription.create.mockRejectedValue(err);

    await expect(grantPremiumForE2E("parent-1")).rejects.toBe(err);
    expect(mockPrisma.subscription.updateMany).toHaveBeenCalledTimes(1);
  });

  it("コードを持たない一般の Error もそのまま投げる", async () => {
    const err = new Error("boom");
    mockPrisma.subscription.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.subscription.create.mockRejectedValue(err);

    await expect(grantPremiumForE2E("parent-1")).rejects.toBe(err);
  });

  it("最初の updateMany の例外もそのまま投げる", async () => {
    const err = new Error("db down");
    mockPrisma.subscription.updateMany.mockRejectedValue(err);

    await expect(grantPremiumForE2E("parent-1")).rejects.toBe(err);
    expect(mockPrisma.subscription.create).not.toHaveBeenCalled();
  });

  it("findFirst で家族の親を探さない（認証した本人の userId を直接使う）", async () => {
    mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });
    await grantPremiumForE2E("parent-1");
    expect(mockPrisma.user.findFirst).not.toHaveBeenCalled();
  });
});

describe("cancelE2ePremium", () => {
  it("条件(PREMIUM/期限なし/platform=E2E/未解約)付き updateMany で canceledAt=now にし canceled", async () => {
    mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });

    const res = await cancelE2ePremium("parent-1", NOW);

    expect(res).toEqual({ status: "canceled" });
    expect(mockPrisma.subscription.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "parent-1",
        plan: "PREMIUM",
        currentPeriodEnd: null,
        platform: "E2E",
        canceledAt: null,
      },
      data: { canceledAt: NOW },
    });
    expect(mockPrisma.subscription.findUnique).not.toHaveBeenCalled();
    expectNoUnconditionalWrites();
  });

  it("0件で行が無ければ not_found", async () => {
    mockPrisma.subscription.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    const res = await cancelE2ePremium("parent-1", NOW);

    expect(res).toEqual({ status: "not_found" });
    expect(mockPrisma.subscription.findUnique).toHaveBeenCalledWith({ where: { userId: "parent-1" } });
  });

  it("0件で canceledAt が入っていれば already_canceled（上書きしない）", async () => {
    mockPrisma.subscription.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", platform: "E2E", canceledAt: new Date("2026-04-01") }),
    );

    const res = await cancelE2ePremium("parent-1", NOW);

    expect(res).toEqual({ status: "already_canceled" });
    expect(mockPrisma.subscription.updateMany).toHaveBeenCalledTimes(1);
    expectNoUnconditionalWrites();
  });

  it.each([
    ["platform が null", { plan: "PREMIUM" as const, platform: null }],
    ["platform が STRIPE", { plan: "PREMIUM" as const, platform: "STRIPE", externalId: "ext-1" }],
    ["期限付き", { plan: "PREMIUM" as const, platform: "E2E", currentPeriodEnd: new Date("2027-01-01") }],
    ["FREE", { plan: "FREE" as const, platform: "E2E" }],
  ])("0件で未解約の別条件の行(%s)は not_eligible で書き換えない", async (_n, overrides) => {
    mockPrisma.subscription.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.subscription.findUnique.mockResolvedValue(subscription(overrides));

    const res = await cancelE2ePremium("parent-1", NOW);

    expect(res).toEqual({ status: "not_eligible" });
    expect(mockPrisma.subscription.updateMany).toHaveBeenCalledTimes(1);
    expectNoUnconditionalWrites();
  });

  it("解約後の行に hasBlockingSubscription を適用すると false（削除ガードを通過できる）", async () => {
    const granted = subscription({ plan: "PREMIUM", platform: "E2E", currentPeriodEnd: null });
    expect(hasBlockingSubscription(granted, NOW)).toBe(true);

    mockPrisma.subscription.updateMany.mockResolvedValue({ count: 1 });
    await cancelE2ePremium("parent-1", NOW);
    const data = mockPrisma.subscription.updateMany.mock.calls[0][0]!.data as { canceledAt: Date };

    expect(hasBlockingSubscription({ ...granted, canceledAt: data.canceledAt }, NOW)).toBe(false);
  });

  it("updateMany の例外はそのまま投げる", async () => {
    const err = new Error("db down");
    mockPrisma.subscription.updateMany.mockRejectedValue(err);
    await expect(cancelE2ePremium("parent-1", NOW)).rejects.toBe(err);
  });
});
