import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/subscription/status/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, subscription } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

function makeGetRequest() {
  return new NextRequest("http://localhost/api/subscription/status");
}

/** groupBy は複雑なジェネリクスのため mockResolvedValue 呼び出し用にキャストする（setup.ts と同じ手法）。 */
function groupByMock(model: { groupBy: unknown }) {
  return model.groupBy as unknown as { mockResolvedValue: (v: unknown[]) => void };
}

beforeEach(() => {
  vi.clearAllMocks();
  // デフォルトは「子なし・タスク/ごほうびなし」。各テストで必要に応じて上書きする。
  prismaMock.user.findMany.mockResolvedValue([]);
  groupByMock(prismaMock.taskTemplate).mockResolvedValue([]);
  groupByMock(prismaMock.treasureItem).mockResolvedValue([]);
});

describe("GET /api/subscription/status — 認証・ロール", () => {
  it("未認証は401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("CHILDロールは403", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });
});

describe("GET /api/subscription/status — 単独モード (familyId=null)", () => {
  it("familyId が無い親は FREE 固定・currentPeriodEnd=null・perChild=[]、user.findMany を呼ばない", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.plan).toBe("FREE");
    expect(json.currentPeriodEnd).toBeNull();
    expect(json.usage.child).toBe(0);
    expect(json.usage.perChild).toEqual([]);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/subscription/status — プラン判定", () => {
  it("Subscription レコード無しは FREE", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.plan).toBe("FREE");
    expect(json.currentPeriodEnd).toBeNull();
    expect(json.limits).toEqual({ child: 1, task: 10, treasure_item: 5 });
  });

  it("PREMIUM 無期限 (currentPeriodEnd=null) はそのまま無期限で返る", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: null }),
    );
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.plan).toBe("PREMIUM");
    expect(json.currentPeriodEnd).toBeNull();
    expect(json.limits).toEqual({ child: null, task: null, treasure_item: null });
  });

  it("PREMIUM 有効期限あり (未来) は currentPeriodEnd を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: new Date("2099-06-15T00:00:00.000Z") }),
    );
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.plan).toBe("PREMIUM");
    expect(json.currentPeriodEnd).not.toBeNull();
    expect(new Date(json.currentPeriodEnd).getUTCFullYear()).toBe(2099);
  });

  it("PREMIUM 期限切れは実効 FREE として返り、currentPeriodEnd は null (生の期限切れ日付をそのまま出さない)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: new Date("2000-01-01T00:00:00.000Z") }),
    );
    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.plan).toBe("FREE");
    expect(json.currentPeriodEnd).toBeNull();
  });
});

describe("GET /api/subscription/status — 課金主体はログイン中の親ではなく family の最初の PARENT", () => {
  it("複数 PARENT がいても getFamilyPlan と同じ PARENT (findFirst) の Subscription を参照する", async () => {
    // ログイン中は parent-2 だが、findFirst で見つかる family の課金主体は parent-1。
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ id: "parent-2" }));
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(
      subscription({ userId: "parent-1", plan: "PREMIUM", currentPeriodEnd: null }),
    );

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { familyId: "fam-1", role: "PARENT" },
      select: { id: true },
    });
    expect(prismaMock.subscription.findUnique).toHaveBeenCalledWith({
      where: { userId: "parent-1" },
    });
    // ログイン中の parent-2 の Subscription は問い合わせない
    expect(prismaMock.subscription.findUnique).not.toHaveBeenCalledWith({
      where: { userId: "parent-2" },
    });
    expect(json.plan).toBe("PREMIUM");
  });
});

describe("GET /api/subscription/status — usage 集計 (groupBy による N+1 回避)", () => {
  it("子一覧・タスク groupBy・ごほうび groupBy の3クエリで完結する (子ごとの count を個別に呼ばない)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "child-1", name: "太郎", monsterName: null },
      { id: "child-2", name: "花子", monsterName: "ユニコーン" },
    ] as never);
    groupByMock(prismaMock.taskTemplate).mockResolvedValue([
      { assignedChildId: "child-1", _count: { _all: 3 } },
    ]);
    groupByMock(prismaMock.treasureItem).mockResolvedValue([
      { childId: "child-2", _count: { _all: 2 } },
    ]);

    const res = await GET(makeGetRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    // 子1人あたり count() を個別に呼んでいない (N+1 にならない)
    expect(prismaMock.taskTemplate.count).not.toHaveBeenCalled();
    expect(prismaMock.treasureItem.count).not.toHaveBeenCalled();
    expect(prismaMock.taskTemplate.groupBy).toHaveBeenCalledTimes(1);
    expect(prismaMock.treasureItem.groupBy).toHaveBeenCalledTimes(1);
    expect(json.usage.child).toBe(2);
  });

  it("子が0人なら perChild は空配列", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValue([]);

    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.usage.child).toBe(0);
    expect(json.usage.perChild).toEqual([]);
  });

  it("タスク・ごほうびが0件の子も perChild に0埋めで残る", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "child-1", name: "太郎", monsterName: null },
    ] as never);
    // groupBy 結果に child-1 が含まれない (タスク・ごほうび0件のため集計結果自体が無い)
    groupByMock(prismaMock.taskTemplate).mockResolvedValue([]);
    groupByMock(prismaMock.treasureItem).mockResolvedValue([]);

    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.usage.perChild).toHaveLength(1);
    expect(json.usage.perChild[0]).toMatchObject({
      childId: "child-1",
      taskCount: 0,
      treasureItemCount: 0,
    });
  });

  it("タスク groupBy の where 条件は countActiveTasksForChild と同じ (isActive/pausedAt/幽霊除外)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "child-1", name: "太郎", monsterName: null },
    ] as never);

    await GET(makeGetRequest());

    const call = (prismaMock.taskTemplate.groupBy as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0]?.[0] as {
      where: {
        familyId?: string;
        isActive: boolean;
        pausedAt: null;
        NOT: { isTemporary: boolean; targetDate: { lt: Date } };
      };
    };
    expect(call.where.isActive).toBe(true);
    expect(call.where.pausedAt).toBeNull();
    expect(call.where.NOT.isTemporary).toBe(true);
    expect(call.where.NOT.targetDate.lt).toBeInstanceOf(Date);
  });
});

describe("GET /api/subscription/status — 表示名フォールバック", () => {
  it("monsterName があれば優先して displayName に使う", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "child-1", name: "太郎", monsterName: "ドラゴン" },
    ] as never);

    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.usage.perChild[0].displayName).toBe("ドラゴン");
  });

  it("monsterName が無ければ name を使う", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "child-1", name: "太郎", monsterName: null },
    ] as never);

    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.usage.perChild[0].displayName).toBe("太郎");
  });

  it("monsterName も name も無ければ「子供」", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "child-1", name: null, monsterName: null },
    ] as never);

    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json.usage.perChild[0].displayName).toBe("子供");
  });
});

describe("GET /api/subscription/status — DB障害", () => {
  it("DB 障害時は 500 JSON を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.user.findFirst.mockRejectedValue(new Error("DB down"));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(typeof json.error).toBe("string");
  });
});
