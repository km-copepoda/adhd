import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "@/app/api/family/members/[id]/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { makeParams } from "../../helpers/request";
import { parentUser, childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DELETE /api/family/members/[id]", () => {
  it("未認証の場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost"), makeParams("child-1"));
    expect(res.status).toBe(403);
  });

  it("CHILDロールの場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await DELETE(new Request("http://localhost"), makeParams("child-1"));
    expect(res.status).toBe(403);
  });

  it("familyIdがない場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser({ familyId: null }) as any);
    const res = await DELETE(new Request("http://localhost"), makeParams("child-1"));
    expect(res.status).toBe(403);
  });

  it("対象の子供が見つからない場合、404を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost"), makeParams("child-999"));
    expect(res.status).toBe(404);
  });

  it("子供アカウントを正常に削除できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser() as any);
    mockPrisma.$transaction.mockResolvedValue([]);

    const res = await DELETE(new Request("http://localhost"), makeParams("child-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });

  it("トランザクションに QuestInstance・Streak・TaskStreak・TaskTemplate(null化)・User の削除が含まれること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser() as any);

    let capturedOps: unknown[] = [];
    mockPrisma.$transaction.mockImplementation(async (ops: unknown) => {
      capturedOps = ops as unknown[];
      return [];
    });

    // 各 deleteMany / updateMany / delete の戻り値を設定
    mockPrisma.questInstance.deleteMany.mockReturnValue({ childId: "child-1" } as any);
    mockPrisma.streak.deleteMany.mockReturnValue({ childId: "child-1" } as any);
    mockPrisma.taskStreak.deleteMany.mockReturnValue({ childId: "child-1" } as any);
    mockPrisma.taskTemplate.updateMany.mockReturnValue({ assignedChildId: null } as any);
    mockPrisma.user.delete.mockReturnValue({ id: "child-1" } as any);

    await DELETE(new Request("http://localhost"), makeParams("child-1"));

    expect(mockPrisma.questInstance.deleteMany).toHaveBeenCalledWith({ where: { childId: "child-1" } });
    expect(mockPrisma.streak.deleteMany).toHaveBeenCalledWith({ where: { childId: "child-1" } });
    expect(mockPrisma.taskStreak.deleteMany).toHaveBeenCalledWith({ where: { childId: "child-1" } });
    expect(mockPrisma.taskTemplate.updateMany).toHaveBeenCalledWith({
      where: { assignedChildId: "child-1" },
      data: { assignedChildId: null },
    });
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: "child-1" } });
    expect(capturedOps).toHaveLength(5);
  });
});
