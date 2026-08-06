import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/tasks/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest } from "../../helpers/request";
import { parentUser, childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

/// FREE プランに対する task 上限 (10 個) の enforce を担保。
/// 仕様: docs/未実装仕様書/monetization-plan.md §2.2 / §4.4
describe("POST /api/tasks — FREE プランのタスク数上限", () => {
  it("FREE で 9/10: 10 個目は追加成功", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null); // FREE
    mockPrisma.taskTemplate.count.mockResolvedValue(9);
    mockPrisma.taskTemplate.create.mockResolvedValue({ id: "t-new" } as never);

    const res = await POST(
      makeRequest("/api/tasks", {
        title: "10 個目",
        category: "STUDY",
        assignedChildId: "child-1",
      }),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.taskTemplate.create).toHaveBeenCalled();
  });

  it("FREE で 10/10: 11 個目は 403 で拒否", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.taskTemplate.count.mockResolvedValue(10);

    const res = await POST(
      makeRequest("/api/tasks", {
        title: "11 個目",
        category: "STUDY",
        assignedChildId: "child-1",
      }),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("PLAN_LIMIT_EXCEEDED");
    expect(json.resource).toBe("task");
    expect(json.limit).toBe(10);
    expect(json.current).toBe(10);
    expect(mockPrisma.taskTemplate.create).not.toHaveBeenCalled();
  });

  it("FREE で 20/10: 過剰にあっても追加は 403", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.taskTemplate.count.mockResolvedValue(20);

    const res = await POST(
      makeRequest("/api/tasks", {
        title: "追加",
        category: "STUDY",
        assignedChildId: "child-1",
      }),
    );
    expect(res.status).toBe(403);
    expect(mockPrisma.taskTemplate.create).not.toHaveBeenCalled();
  });

  it("PREMIUM 有効期間中は上限なしで作成可能", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "PREMIUM",
      currentPeriodEnd: new Date("2099-12-31"),
    } as never);
    mockPrisma.taskTemplate.count.mockResolvedValue(999);
    mockPrisma.taskTemplate.create.mockResolvedValue({ id: "t-premium" } as never);

    const res = await POST(
      makeRequest("/api/tasks", {
        title: "無制限",
        category: "STUDY",
        assignedChildId: "child-1",
      }),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.taskTemplate.create).toHaveBeenCalled();
  });

  it("カウントは assignedChildId ごと (isActive && pausedAt IS NULL) に限定", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.taskTemplate.count.mockResolvedValue(0);
    mockPrisma.taskTemplate.create.mockResolvedValue({ id: "t-1" } as never);

    await POST(
      makeRequest("/api/tasks", {
        title: "test",
        category: "STUDY",
        assignedChildId: "child-1",
      }),
    );

    expect(mockPrisma.taskTemplate.count).toHaveBeenCalledWith({
      where: {
        assignedChildId: "child-1",
        isActive: true,
        pausedAt: null,
      },
    });
  });

  it("CHILD が作成する場合も、familyId の PARENT のプランで判定", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as never);
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null); // FREE
    mockPrisma.taskTemplate.count.mockResolvedValue(10); // 既に上限

    const res = await POST(
      makeRequest("/api/tasks", {
        title: "子供追加",
        category: "STUDY",
        isTemporary: true,
      }),
    );
    expect(res.status).toBe(403);
    // 親を探しに行ったこと
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: { familyId: "fam-1", role: "PARENT" },
      select: { id: true },
    });
    // 上限チェックは CHILD 自身の assignedChildId (self.id) を対象に
    expect(mockPrisma.taskTemplate.count).toHaveBeenCalledWith({
      where: {
        assignedChildId: "child-1",
        isActive: true,
        pausedAt: null,
      },
    });
  });

  it("assignedChildId 未指定 (PARENT) は既存の 400 が優先される (制限チェック前)", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as never);

    const res = await POST(
      makeRequest("/api/tasks", { title: "test", category: "STUDY" }),
    );
    expect(res.status).toBe(400);
    // 上限チェックまで到達しないこと
    expect(mockPrisma.taskTemplate.count).not.toHaveBeenCalled();
  });
});
