import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "@/app/api/family/members/[id]/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { makeParams } from "../../helpers/request";
import { parentUserWithFamily, childUserWithFamily, childUser } from "../../helpers/fixtures";

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
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await DELETE(new Request("http://localhost"), makeParams("child-1"));
    expect(res.status).toBe(403);
  });

  it("familyIdがない場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }, null));
    const res = await DELETE(new Request("http://localhost"), makeParams("child-1"));
    expect(res.status).toBe(403);
  });

  it("対象の子供が見つからない場合、404を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await DELETE(new Request("http://localhost"), makeParams("child-999"));
    expect(res.status).toBe(404);
  });

  it("子供アカウントを正常に削除できること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser());
    mockPrisma.$transaction.mockResolvedValue([]);

    const res = await DELETE(new Request("http://localhost"), makeParams("child-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });

  it("トランザクションに QuestInstance・Streak・TaskStreak・TaskTemplate(null化)・User の削除が含まれること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser());

    let capturedOps: unknown[] = [];
    // `prisma.$transaction` は配列版（`Prisma.PrismaPromise[]`）とコールバック版
    // （`(prisma) => Promise<T>`）のオーバーロードを持つが、DeepMockProxy の
    // `mockImplementation` はコールバック版のシグネチャしか型推論できない。
    // 実装（route.ts）は配列版で呼んでいるため、setup.ts の $transaction デフォルト
    // 実装と同様に `unknown[]` を受け取る関数へキャストする。
    const transactionMock = mockPrisma.$transaction as unknown as {
      mockImplementation: (fn: (ops: unknown[]) => Promise<unknown[]>) => void;
    };
    transactionMock.mockImplementation(async (ops) => {
      capturedOps = ops;
      return [];
    });

    // 各 deleteMany / updateMany / delete の戻り値を設定
    mockPrisma.questInstance.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.streak.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.taskStreak.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.taskTemplate.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.delete.mockResolvedValue(childUser({ id: "child-1" }));

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
