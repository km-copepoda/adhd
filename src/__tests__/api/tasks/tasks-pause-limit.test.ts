import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/tasks/[id]/pause/route";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest, makeParams } from "../../helpers/request";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { parentUserWithFamily, parentUser, taskTemplate, subscription } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
});

/// 停止 (paused=true) は無制限。再開 (paused=false) 時のみプラン上限を再確認する。
/// 仕様: docs/未実装仕様書/monetization-plan.md §4.4 (「タスク再開」列)
describe("POST /api/tasks/[id]/pause — 再開時の上限チェック", () => {
  it("paused=true: プランに関わらず成功 (上限チェックしない)", async () => {
    mockPrisma.taskTemplate.findUnique.mockResolvedValue(
      taskTemplate({ assignedChildId: "child-1" }),
    );
    mockPrisma.subscription.findUnique.mockResolvedValue(null); // FREE
    mockPrisma.taskTemplate.count.mockResolvedValue(999); // 意図的に超過
    mockPrisma.taskTemplate.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: true }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.taskTemplate.count).not.toHaveBeenCalled();
    expect(mockPrisma.taskTemplate.updateMany).toHaveBeenCalled();
  });

  it("paused=false + FREE + 現在 9 個 active: 再開成功", async () => {
    mockPrisma.taskTemplate.findUnique.mockResolvedValue(
      taskTemplate({ assignedChildId: "child-1" }),
    );
    mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.taskTemplate.count.mockResolvedValue(9);
    mockPrisma.taskTemplate.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: false }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
  });

  it("paused=false + FREE + 現在 10 個 active: 再開拒否 (403)", async () => {
    mockPrisma.taskTemplate.findUnique.mockResolvedValue(
      taskTemplate({ assignedChildId: "child-1" }),
    );
    mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.taskTemplate.count.mockResolvedValue(10);

    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: false }),
      makeParams("t1"),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("PLAN_LIMIT_EXCEEDED");
    expect(json.resource).toBe("task");
    expect(mockPrisma.taskTemplate.updateMany).not.toHaveBeenCalled();
  });

  it("paused=false + PREMIUM: 無制限に再開成功", async () => {
    mockPrisma.taskTemplate.findUnique.mockResolvedValue(
      taskTemplate({ assignedChildId: "child-1" }),
    );
    mockPrisma.user.findFirst.mockResolvedValue(parentUser({ id: "parent-1" }));
    mockPrisma.subscription.findUnique.mockResolvedValue(
      subscription({ plan: "PREMIUM", currentPeriodEnd: new Date("2099-12-31") }),
    );
    mockPrisma.taskTemplate.count.mockResolvedValue(999);
    mockPrisma.taskTemplate.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(
      makeRequest("/api/tasks/t1/pause", { paused: false }),
      makeParams("t1"),
    );
    expect(res.status).toBe(200);
  });

  it("paused=false: 対象タスクが存在しない場合 404", async () => {
    mockPrisma.taskTemplate.findUnique.mockResolvedValue(null);

    const res = await POST(
      makeRequest("/api/tasks/no-such/pause", { paused: false }),
      makeParams("no-such"),
    );
    expect(res.status).toBe(404);
    expect(mockPrisma.taskTemplate.updateMany).not.toHaveBeenCalled();
  });
});
