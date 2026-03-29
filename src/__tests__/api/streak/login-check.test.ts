import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { POST } from "@/app/api/streak/login-check/route";
import { childUser, streak, parentUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/streak/login-check", () => {
  it("未認証の場合、401を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("親ユーザーの場合、403を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUser() as any);

    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("初回ログインで loginStreak=1 を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 0, loginBestStreak: 0, lastLoginDate: null }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.loginStreak).toBe(1);
    expect(json.bonusGranted).toBe(0);
  });

  it("30日目にボーナスが付与されること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 29, loginBestStreak: 29, lastLoginDate: yesterday }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ studyPt: 0, staminaPt: 0, lifePt: 0 }) as any,
    );
    mockPrisma.user.update.mockResolvedValue({} as any);

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.loginStreak).toBe(30);
    expect(json.bonusGranted).toBe(1);
  });
});
