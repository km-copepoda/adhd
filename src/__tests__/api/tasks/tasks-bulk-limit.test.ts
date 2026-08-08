import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/tasks/bulk/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest } from "../../helpers/request";
import { parentUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

function bulkReq(tasks: Array<{ title: string; category: string; repeatDays: number[] }>) {
  return makeRequest("/api/tasks/bulk", {
    assignedChildId: "child-1",
    tasks,
  });
}

const oneTask = { title: "宿題", category: "STUDY", repeatDays: [1, 2, 3, 4, 5] };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(parentUser() as never);
});

/// bulk 作成も FREE プランのタスク上限を enforce する (合計 <= 10 個)。
/// 仕様: monetization-plan.md §2.2 / §4.4
describe("POST /api/tasks/bulk — FREE プランのタスク数上限 (バルク)", () => {
  it("FREE + 0 個 + 11 個 bulk: 403 (合計 11 > 10)", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce({ id: "child-1" } as never) // ensureFamilyChild
      .mockResolvedValueOnce({ id: "parent-1" } as never); // getFamilyPlan
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.taskTemplate.count.mockResolvedValue(0);

    const res = await POST(bulkReq(Array(11).fill(oneTask)));

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("PLAN_LIMIT_EXCEEDED");
    expect(json.resource).toBe("task");
    expect(mockPrisma.taskTemplate.createMany).not.toHaveBeenCalled();
  });

  it("FREE + 0 個 + 10 個 bulk: 上限ちょうどで成功", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce({ id: "child-1" } as never)
      .mockResolvedValueOnce({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.taskTemplate.count.mockResolvedValue(0);
    mockPrisma.taskTemplate.createMany.mockResolvedValue({ count: 10 } as never);

    const res = await POST(bulkReq(Array(10).fill(oneTask)));
    expect(res.status).toBe(200);
  });

  it("FREE + 既に 3 個 + 8 個 bulk: 403 (合計 11)", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce({ id: "child-1" } as never)
      .mockResolvedValueOnce({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.taskTemplate.count.mockResolvedValue(3);

    const res = await POST(bulkReq(Array(8).fill(oneTask)));
    expect(res.status).toBe(403);
    expect(mockPrisma.taskTemplate.createMany).not.toHaveBeenCalled();
  });

  it("FREE + 既に 3 個 + 7 個 bulk: 合計 10 で成功", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce({ id: "child-1" } as never)
      .mockResolvedValueOnce({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.taskTemplate.count.mockResolvedValue(3);
    mockPrisma.taskTemplate.createMany.mockResolvedValue({ count: 7 } as never);

    const res = await POST(bulkReq(Array(7).fill(oneTask)));
    expect(res.status).toBe(200);
  });

  it("PREMIUM は 30 個でも成功 (bulk 自体の 30 上限内)", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce({ id: "child-1" } as never)
      .mockResolvedValueOnce({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "PREMIUM",
      currentPeriodEnd: new Date("2099-12-31"),
    } as never);
    mockPrisma.taskTemplate.count.mockResolvedValue(100);
    mockPrisma.taskTemplate.createMany.mockResolvedValue({ count: 30 } as never);

    const res = await POST(bulkReq(Array(30).fill(oneTask)));
    expect(res.status).toBe(200);
  });
});
