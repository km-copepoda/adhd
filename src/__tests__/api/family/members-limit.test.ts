import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/family/members/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { makeRequest } from "../../helpers/request";
import { parentUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(parentUser() as never);
});

/// FREE プランの子アカウント上限 (Family 内 1 人まで) は、実際の子作成経路である
/// POST /api/family/members に enforce する。
/// (旧仕様の /api/auth/child-join は削除済み)
/// 仕様: docs/未実装仕様書/monetization-plan.md §2.1 / §4.4
describe("POST /api/family/members — FREE プランの子アカウント上限", () => {
  it("FREE で既に 1 人子がいる: 2 人目の追加は 403", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as never); // getFamilyPlan
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.user.count.mockResolvedValue(1); // 既に 1 人

    const res = await POST(
      makeRequest("/api/family/members", { monsterName: "2人目", side: "LIGHT" }),
    );

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("PLAN_LIMIT_EXCEEDED");
    expect(json.resource).toBe("child");
    expect(json.limit).toBe(1);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
  });

  it("FREE で 0 人: 1 人目は追加成功", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.user.findUnique.mockResolvedValue(null); // childCode 重複なし
    mockPrisma.user.create.mockResolvedValue({
      id: "db-1",
      monsterName: "1人目",
      side: "LIGHT",
      childCode: "0001",
    } as never);

    const res = await POST(
      makeRequest("/api/family/members", { monsterName: "1人目", side: "LIGHT" }),
    );
    expect(res.status).toBe(200);
  });

  it("PREMIUM は 5 人目でも追加成功", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "PREMIUM",
      currentPeriodEnd: new Date("2099-12-31"),
    } as never);
    mockPrisma.user.count.mockResolvedValue(4);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "db-5",
      monsterName: "5人目",
      side: "LIGHT",
      childCode: "0005",
    } as never);

    const res = await POST(
      makeRequest("/api/family/members", { monsterName: "5人目", side: "LIGHT" }),
    );
    expect(res.status).toBe(200);
  });

  it("カウントは familyId + role: CHILD のみ", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue({
      id: "db-x",
      monsterName: "x",
      side: "LIGHT",
      childCode: "1111",
    } as never);

    await POST(
      makeRequest("/api/family/members", { monsterName: "x", side: "LIGHT" }),
    );

    expect(mockPrisma.user.count).toHaveBeenCalledWith({
      where: { familyId: "fam-1", role: "CHILD" },
    });
  });
});
