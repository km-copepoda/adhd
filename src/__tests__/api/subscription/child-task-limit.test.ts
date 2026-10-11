import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/subscription/child-task-limit/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, subscription } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

function makeGetRequest(query = "") {
  return new NextRequest(`http://localhost/api/subscription/child-task-limit${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/subscription/child-task-limit — 認証・ロール", () => {
  it("未認証は401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("PARENTロールは403", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
  });
});

describe("GET /api/subscription/child-task-limit — 返却内容", () => {
  it("FREE の子は limit:10、現在の有効タスク数が current", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.taskTemplate.count.mockResolvedValue(4);

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ limit: 10, current: 4 });
  });

  it("PREMIUM の子は limit:null (無制限)", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: null }),
    );
    prismaMock.taskTemplate.count.mockResolvedValue(42);

    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(json).toEqual({ limit: null, current: 42 });
  });

  it("familyId が無い (単独モード) は FREE 固定・current:0 を返し、count を呼ばない", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ familyId: null }, null));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ limit: 10, current: 0 });
    expect(prismaMock.taskTemplate.count).not.toHaveBeenCalled();
  });

  it("自分自身の件数だけ数える (assignedChildId は認証済みユーザーの id)", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.taskTemplate.count.mockResolvedValue(0);

    await GET(makeGetRequest());

    const call = prismaMock.taskTemplate.count.mock.calls[0]?.[0] as {
      where: { assignedChildId: string };
    };
    expect(call.where.assignedChildId).toBe("child-1");
  });

  it("クエリパラメータで他の childId を指定しても無視し、自分自身の件数のみ返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.taskTemplate.count.mockResolvedValue(7);

    const res = await GET(makeGetRequest("?childId=child-999"));
    const json = await res.json();
    expect(json.current).toBe(7);

    const call = prismaMock.taskTemplate.count.mock.calls[0]?.[0] as {
      where: { assignedChildId: string };
    };
    expect(call.where.assignedChildId).toBe("child-1");
    expect(call.where.assignedChildId).not.toBe("child-999");
  });

  it("カウントは isActive/pausedAt=null/幽霊一時タスク除外に限定される (countActiveTasksForChild と同じ条件)", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.taskTemplate.count.mockResolvedValue(0);

    await GET(makeGetRequest());

    const call = prismaMock.taskTemplate.count.mock.calls[0]?.[0] as {
      where: {
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

  it("レスポンス本文に plan / currentPeriodEnd / プラン名・課金文言を含めない (§5.1準拠)", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
    prismaMock.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    prismaMock.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: null }),
    );
    prismaMock.taskTemplate.count.mockResolvedValue(0);

    const res = await GET(makeGetRequest());
    const json = await res.json();
    expect(Object.keys(json).sort()).toEqual(["current", "limit"]);
    const raw = JSON.stringify(json);
    expect(raw).not.toMatch(/プレミアム|プラン|FREE|PREMIUM/);
  });
});

describe("GET /api/subscription/child-task-limit — DB障害", () => {
  it("DB 障害時は 500 JSON を返す。エラー本文にもプラン文言を含めない", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ id: "child-1" }));
    prismaMock.user.findFirst.mockRejectedValue(new Error("DB down"));

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(typeof json.error).toBe("string");
    expect(json.error).not.toMatch(/プレミアム|プラン/);
  });
});
