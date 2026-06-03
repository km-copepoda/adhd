import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { GET } from "@/app/api/badges/unseen-count/route";
import { childUser, parentUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/badges/unseen-count", () => {
  it("未認証または親ロールは 403", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res1 = await GET();
    expect(res1.status).toBe(403);

    mockGetCurrentUser.mockResolvedValue(parentUser() as any);
    const res2 = await GET();
    expect(res2.status).toBe(403);
  });

  it("count は ALL_BADGES の ID 集合に絞ったクエリで実行する（旧IDを含まない）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.userBadge.count.mockResolvedValue(3);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.unlockedCount).toBe(3);

    const countCall = (mockPrisma.userBadge.count as any).mock.calls[0][0];
    expect(countCall.where.userId).toBe("child-1");
    // ALL_BADGES の ID 集合で絞る where 句が指定されていること
    expect(countCall.where.badgeId).toBeDefined();
    expect(countCall.where.badgeId.in).toBeInstanceOf(Array);
    expect(countCall.where.badgeId.in.length).toBe(100);
    // 旧IDは含まれない
    expect(countCall.where.badgeId.in).not.toContain("first_approval");
    expect(countCall.where.badgeId.in).not.toContain("streak_3");
    // 現行IDのサンプルは含まれる
    expect(countCall.where.badgeId.in).toContain("first_quest");
  });
});
