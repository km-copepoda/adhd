import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkAndUnlockBadges } from "@/lib/badges";
import { triggerBadgeLog } from "@/lib/bulletinLog";
import { GET } from "@/app/api/badges/route";
import { childUser, parentUser } from "../../helpers/fixtures";

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

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.userBadge.findMany.mockResolvedValue([]);
});

describe("GET /api/badges", () => {
  it("子供以外（親 or 未認証）は 403", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res = await GET();
    expect(res.status).toBe(403);

    mockGetCurrentUser.mockResolvedValue(null);
    const res2 = await GET();
    expect(res2.status).toBe(403);
  });

  it("新規解除されたバッジを掲示板に流す（triggerBadgeLog 呼び出し）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockCheckAndUnlockBadges.mockResolvedValue([
      { id: "first_step", name: "はじめの一歩", emoji: "🌱", description: "..." },
      { id: "login_14", name: "2週間ログイン", emoji: "🌿", description: "..." },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    await new Promise((r) => setImmediate(r));

    expect(mockTriggerBadgeLog).toHaveBeenCalledTimes(2);
    expect(mockTriggerBadgeLog).toHaveBeenCalledWith("child-1", "はじめの一歩");
    expect(mockTriggerBadgeLog).toHaveBeenCalledWith("child-1", "2週間ログイン");
  });

  it("新規解除がなければ triggerBadgeLog は呼ばれない", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockCheckAndUnlockBadges.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    await new Promise((r) => setImmediate(r));

    expect(mockTriggerBadgeLog).not.toHaveBeenCalled();
  });
});
