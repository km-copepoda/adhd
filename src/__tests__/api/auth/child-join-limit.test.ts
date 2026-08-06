import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/child-join/route";
import { prisma } from "@/lib/prisma";
import { makeRequest } from "../../helpers/request";
import { mockSupabaseUser } from "../../helpers/auth-mock";
import { family } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);

const req = (body: Record<string, unknown>) => makeRequest("/api/auth/child-join", body);

beforeEach(() => vi.clearAllMocks());

/// FREE プランの子アカウント上限 (Family 内 1 人まで) の enforce を担保。
/// 仕様: docs/未実装仕様書/monetization-plan.md §2.1 / §4.4
describe("POST /api/auth/child-join — FREE プランの子アカウント上限", () => {
  it("FREE で既に 1 人子がいる: 2 人目の join は 403", async () => {
    mockSupabaseUser({ id: "sup-2nd" });
    mockPrisma.family.findUnique.mockResolvedValue(family() as never);
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as never); // getFamilyPlan 用
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.user.count.mockResolvedValue(1); // 既に 1 人

    const res = await POST(
      req({ monsterName: "2 人目", side: "LIGHT", familyCode: "ABCDEF" }),
    );
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.code).toBe("PLAN_LIMIT_EXCEEDED");
    expect(json.resource).toBe("child");
    expect(json.limit).toBe(1);
    expect(mockPrisma.user.upsert).not.toHaveBeenCalled();
  });

  it("FREE で 0 人: 1 人目は join 成功", async () => {
    mockSupabaseUser({ id: "sup-1st" });
    mockPrisma.family.findUnique.mockResolvedValue(family() as never);
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.user.findUnique.mockResolvedValue(null); // childCode 重複なし
    mockPrisma.user.upsert.mockResolvedValue({ id: "db-1", childCode: "0001" } as never);

    const res = await POST(
      req({ monsterName: "1 人目", side: "LIGHT", familyCode: "ABCDEF" }),
    );
    expect(res.status).toBe(200);
  });

  it("PREMIUM は 5 人目でも join 成功", async () => {
    mockSupabaseUser({ id: "sup-5th" });
    mockPrisma.family.findUnique.mockResolvedValue(family() as never);
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-1" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue({
      plan: "PREMIUM",
      currentPeriodEnd: new Date("2099-12-31"),
    } as never);
    mockPrisma.user.count.mockResolvedValue(4);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.upsert.mockResolvedValue({ id: "db-5", childCode: "0005" } as never);

    const res = await POST(
      req({ monsterName: "5 人目", side: "LIGHT", familyCode: "ABCDEF" }),
    );
    expect(res.status).toBe(200);
  });

  it("familyCode なし (単独モード) は上限チェック不要 (常に成功)", async () => {
    mockSupabaseUser({ id: "sup-solo" });
    mockPrisma.user.upsert.mockResolvedValue({ id: "db-solo", childCode: null } as never);

    const res = await POST(req({ monsterName: "単独", side: "LIGHT", familyCode: "" }));
    expect(res.status).toBe(200);
    // 単独モードは family lookup がそもそも走らないので count も呼ばれない
    expect(mockPrisma.user.count).not.toHaveBeenCalled();
  });

  it("カウントは familyId + role: CHILD のみ", async () => {
    mockSupabaseUser({ id: "sup-count" });
    mockPrisma.family.findUnique.mockResolvedValue(family({ id: "fam-x" }) as never);
    mockPrisma.user.findFirst.mockResolvedValue({ id: "parent-x" } as never);
    mockPrisma.subscription.findUnique.mockResolvedValue(null);
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.upsert.mockResolvedValue({ id: "db-x", childCode: "1111" } as never);

    await POST(req({ monsterName: "x", side: "LIGHT", familyCode: "FAMXYZ" }));

    expect(mockPrisma.user.count).toHaveBeenCalledWith({
      where: { familyId: "fam-x", role: "CHILD" },
    });
  });
});
