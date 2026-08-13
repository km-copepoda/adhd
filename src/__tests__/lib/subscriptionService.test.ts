import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getSubscription,
  getUserPlan,
  getFamilyPlan,
  countActiveTasksForChild,
} from "@/lib/subscriptionService";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import { parentUser, subscription } from "../helpers/fixtures";

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
    const row = subscription({
      id: "sub-1",
      userId: "user-1",
      plan: "PREMIUM",
      platform: "web",
      externalId: "cus_xxx",
      currentPeriodEnd: new Date("2026-09-06"),
    });
    mockPrisma.subscription.findUnique.mockResolvedValue(row);

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
    mockPrisma.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "FREE", currentPeriodEnd: null }),
    );

    const plan = await getUserPlan("user-1", now);
    expect(plan).toBe("FREE");
  });

  it("plan=PREMIUM で期間有効 → PREMIUM", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: new Date("2026-09-06") }),
    );

    const plan = await getUserPlan("user-1", now);
    expect(plan).toBe("PREMIUM");
  });

  it("plan=PREMIUM で期間切れ → FREE (grace period なし)", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: new Date("2026-07-01") }),
    );

    const plan = await getUserPlan("user-1", now);
    expect(plan).toBe("FREE");
  });

  it("plan=PREMIUM で currentPeriodEnd=null は PREMIUM (無期限扱い、手動付与など)", async () => {
    mockPrisma.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: null }),
    );

    const plan = await getUserPlan("user-1", now);
    expect(plan).toBe("PREMIUM");
  });
});

describe("getFamilyPlan", () => {
  const now = new Date("2026-08-06T00:00:00Z");

  it("Family に PARENT がいなければ FREE (安全側フォールバック)", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const plan = await getFamilyPlan("fam-1", now);

    expect(plan).toBe("FREE");
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { familyId: "fam-1", role: "PARENT" },
      select: { id: true },
    });
  });

  it("PARENT の Subscription が無ければ FREE", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    const plan = await getFamilyPlan("fam-1", now);

    expect(plan).toBe("FREE");
  });

  it("PARENT が PREMIUM 有効期間中なら PREMIUM", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: new Date("2026-09-06") }),
    );

    const plan = await getFamilyPlan("fam-1", now);
    expect(plan).toBe("PREMIUM");
  });

  it("PARENT の Subscription が期限切れなら FREE", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: new Date("2026-07-01") }),
    );

    const plan = await getFamilyPlan("fam-1", now);
    expect(plan).toBe("FREE");
  });
});

/// FREE プラン上限用の「有効な (幽霊でない) タスク数」カウント。
/// - 通常タスク (isTemporary=false) / 目標日 null / 目標日 >= today の一時タスクは含める
/// - 目標日 < today の一時タスク (=親画面に表示されない幽霊) は除外する
describe("countActiveTasksForChild", () => {
  const today = new Date("2026-08-10T00:00:00.000Z"); // JST 日付想定 (UTC 0時保存)

  it("assignedChildId + isActive + pausedAt=null + 幽霊除外 の where 句でカウントする", async () => {
    mockPrisma.taskTemplate.count.mockResolvedValue(3);

    const count = await countActiveTasksForChild("child-1", today);

    expect(count).toBe(3);
    expect(mockPrisma.taskTemplate.count).toHaveBeenCalledWith({
      where: {
        assignedChildId: "child-1",
        isActive: true,
        pausedAt: null,
        NOT: {
          isTemporary: true,
          targetDate: { lt: today },
        },
      },
    });
  });

  it("today 省略時は現在の JST 今日を使う (境界: today と等しい targetDate は幽霊扱いにしない)", async () => {
    mockPrisma.taskTemplate.count.mockResolvedValue(0);

    await countActiveTasksForChild("child-1");

    const call = mockPrisma.taskTemplate.count.mock.calls[0]?.[0] as
      | { where?: { NOT?: { targetDate?: { lt?: Date } } } }
      | undefined;
    const lt = call?.where?.NOT?.targetDate?.lt;
    expect(lt).toBeInstanceOf(Date);
    // lt は today ちょうど。境界の targetDate == today は幽霊にならない (lt なので)。
    // 日次で変わる値なので絶対値ではなく型のみ確認。
  });
});
