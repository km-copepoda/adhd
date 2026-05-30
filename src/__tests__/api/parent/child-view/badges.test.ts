import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkAndUnlockBadges } from "@/lib/badges";
import { triggerBadgeLog } from "@/lib/bulletinLog";
import { GET } from "@/app/api/parent/child-view/badges/route";
import { childUser, parentUser } from "../../../helpers/fixtures";

vi.mock("@/lib/badges", async () => {
  const actual = await vi.importActual<typeof import("@/lib/badges")>("@/lib/badges");
  return {
    ...actual,
    checkAndUnlockBadges: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@/lib/bulletinLog", () => ({
  triggerBadgeLog: vi.fn().mockResolvedValue(undefined),
}));

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockCheckAndUnlockBadges = vi.mocked(checkAndUnlockBadges);
const mockTriggerBadgeLog = vi.mocked(triggerBadgeLog);

function makeReq(childId?: string) {
  const url = childId !== undefined
    ? `http://localhost/api/parent/child-view/badges?childId=${childId}`
    : "http://localhost/api/parent/child-view/badges";
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.userBadge.findMany.mockResolvedValue([]);
});

describe("GET /api/parent/child-view/badges", () => {
  it("未認証で401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(401);
  });

  it("CHILD ロールで403", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(403);
  });

  it("childId 未指定で400", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await GET(makeReq(""));
    expect(res.status).toBe(400);
  });

  it("別 family の子を指定された場合、404", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq("child-other"));
    expect(res.status).toBe(404);
  });

  it("正常系: 子供の childId で checkAndUnlockBadges / userBadge.findMany を呼ぶ", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockCheckAndUnlockBadges.mockResolvedValue([]);
    mockPrisma.userBadge.findMany.mockResolvedValue([
      { badgeId: "first_step", unlockedAt: new Date("2026-05-01") },
    ] as any);

    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.totalCount).toBeGreaterThan(0);
    expect(json.unlockedCount).toBe(1);
    expect(Array.isArray(json.badges)).toBe(true);

    expect(mockCheckAndUnlockBadges).toHaveBeenCalledWith("child-1");
    const findManyCall = (mockPrisma.userBadge.findMany as any).mock.calls[0][0];
    expect(findManyCall.where.userId).toBe("child-1");
  });

  it("新規解除されたバッジを掲示板に流す（triggerBadgeLog 呼び出し）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }) as any);
    mockCheckAndUnlockBadges.mockResolvedValue([
      { id: "first_step", name: "はじめの一歩", emoji: "🌱", description: "..." } as any,
    ]);

    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(200);
    await new Promise((r) => setImmediate(r));

    expect(mockTriggerBadgeLog).toHaveBeenCalledWith("child-1", "はじめの一歩");
  });
});
