import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/subscription/status/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parentUser, childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

/// GET /api/subscription/status — 親プランと Family の使用状況を返す
/// 仕様: docs/未実装仕様書/monetization-plan.md §4.2 / §5.2
describe("GET /api/subscription/status", () => {
  it("未認証は 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("CHILD は 403 (課金主体は PARENT)", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("PARENT + Subscription レコード無し → FREE + limits + usage", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "child-1", name: "太郎", monsterName: "リュウ" },
      { id: "child-2", name: "花子", monsterName: null },
    ] as never);
    // taskTemplate.count / treasureItem.count は個別 child 用に複数回呼ばれる想定
    mockPrisma.taskTemplate.count
      .mockResolvedValueOnce(3) // child-1
      .mockResolvedValueOnce(0); // child-2
    mockPrisma.treasureItem.count
      .mockResolvedValueOnce(2) // child-1
      .mockResolvedValueOnce(1); // child-2

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.plan).toBe("FREE");
    expect(json.currentPeriodEnd).toBeNull();
    expect(json.limits).toEqual({ child: 1, task: 10, treasure_item: 5 });
    expect(json.usage.child).toBe(2);
    expect(json.usage.perChild).toEqual([
      { childId: "child-1", name: "リュウ", taskCount: 3, treasureItemCount: 2 },
      { childId: "child-2", name: "花子", taskCount: 0, treasureItemCount: 1 },
    ]);
  });

  it("PARENT + PREMIUM 有効期限内 → PREMIUM + limits null (無制限)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    const periodEnd = new Date("2099-12-31T00:00:00Z");
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "PREMIUM",
      currentPeriodEnd: periodEnd,
    } as never);
    mockPrisma.user.findMany.mockResolvedValue([] as never);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.plan).toBe("PREMIUM");
    expect(new Date(json.currentPeriodEnd).getTime()).toBe(periodEnd.getTime());
    expect(json.limits).toEqual({ child: null, task: null, treasure_item: null });
    expect(json.usage.child).toBe(0);
    expect(json.usage.perChild).toEqual([]);
  });

  it("PARENT + PREMIUM 期限切れ → FREE 扱い", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "PREMIUM",
      currentPeriodEnd: new Date("2000-01-01"),
    } as never);
    mockPrisma.user.findMany.mockResolvedValue([] as never);

    const res = await GET();
    const json = await res.json();
    expect(json.plan).toBe("FREE");
    expect(json.limits.task).toBe(10);
  });

  it("PARENT + PREMIUM currentPeriodEnd=null → 無期限 PREMIUM (手動付与)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "PREMIUM",
      currentPeriodEnd: null,
    } as never);
    mockPrisma.user.findMany.mockResolvedValue([] as never);

    const res = await GET();
    const json = await res.json();
    expect(json.plan).toBe("PREMIUM");
    expect(json.currentPeriodEnd).toBeNull();
  });

  it("familyId=null (単独モード PARENT) は FREE + perChild 空", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.plan).toBe("FREE");
    expect(json.usage.child).toBe(0);
    expect(json.usage.perChild).toEqual([]);
    // 単独モードでは子を数えないので findMany は呼ばれない
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("子の usage カウントは isActive/pausedAt=null 条件で問い合わせる", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      { id: "child-1", name: "太郎", monsterName: null },
    ] as never);
    mockPrisma.taskTemplate.count.mockResolvedValue(0);
    mockPrisma.treasureItem.count.mockResolvedValue(0);

    await GET();

    expect(mockPrisma.taskTemplate.count).toHaveBeenCalledWith({
      where: { assignedChildId: "child-1", isActive: true, pausedAt: null },
    });
    expect(mockPrisma.treasureItem.count).toHaveBeenCalledWith({
      where: { childId: "child-1", isActive: true },
    });
  });
});
