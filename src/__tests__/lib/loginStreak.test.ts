import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordLoginActivity } from "@/lib/loginStreak";
import { childUser, streak } from "../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordLoginActivity", () => {
  const today = new Date("2026-03-29");

  it("初回ログインで loginCurrentStreak=1 になる", async () => {
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 0, loginBestStreak: 0, lastLoginDate: null }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);

    const result = await recordLoginActivity("child-1", today);

    expect(mockPrisma.streak.update).toHaveBeenCalledWith({
      where: { childId: "child-1" },
      data: {
        loginCurrentStreak: 1,
        loginBestStreak: 1,
        lastLoginDate: expect.any(Date),
      },
    });
    expect(result.loginStreak).toBe(1);
    expect(result.bonusGranted).toBe(0);
  });

  it("同日2回目のログインでは変化なし", async () => {
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 3, loginBestStreak: 5, lastLoginDate: today }) as any,
    );

    const result = await recordLoginActivity("child-1", today);

    expect(mockPrisma.streak.update).not.toHaveBeenCalled();
    expect(result.loginStreak).toBe(3);
    expect(result.bonusGranted).toBe(0);
  });

  it("昨日もログインしていれば連続日数が +1 になる", async () => {
    const yesterday = new Date("2026-03-28");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 5, loginBestStreak: 10, lastLoginDate: yesterday }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);

    const result = await recordLoginActivity("child-1", today);

    expect(mockPrisma.streak.update).toHaveBeenCalledWith({
      where: { childId: "child-1" },
      data: {
        loginCurrentStreak: 6,
        loginBestStreak: 10,
        lastLoginDate: expect.any(Date),
      },
    });
    expect(result.loginStreak).toBe(6);
  });

  it("途切れた場合は loginCurrentStreak=1 にリセット、bestStreak は保持", async () => {
    const threeDaysAgo = new Date("2026-03-26");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 10, loginBestStreak: 20, lastLoginDate: threeDaysAgo }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);

    const result = await recordLoginActivity("child-1", today);

    expect(mockPrisma.streak.update).toHaveBeenCalledWith({
      where: { childId: "child-1" },
      data: {
        loginCurrentStreak: 1,
        loginBestStreak: 20,
        lastLoginDate: expect.any(Date),
      },
    });
    expect(result.loginStreak).toBe(1);
  });

  it("30日連続ログインで +1pt ボーナスが付与される", async () => {
    const yesterday = new Date("2026-03-28");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 29, loginBestStreak: 29, lastLoginDate: yesterday }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ studyPt: 0, staminaPt: 0, lifePt: 0 }) as any,
    );
    mockPrisma.user.update.mockResolvedValue({} as any);

    const result = await recordLoginActivity("child-1", today);

    expect(result.loginStreak).toBe(30);
    expect(result.bonusGranted).toBe(1);
    expect(mockPrisma.user.update).toHaveBeenCalled();
  });

  it("60日連続で再度 +1pt ボーナスが付与される（反復マイルストーン）", async () => {
    const yesterday = new Date("2026-03-28");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 59, loginBestStreak: 59, lastLoginDate: yesterday }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);
    mockPrisma.user.findUnique.mockResolvedValue(
      childUser({ studyPt: 5, staminaPt: 3, lifePt: 2 }) as any,
    );
    mockPrisma.user.update.mockResolvedValue({} as any);

    const result = await recordLoginActivity("child-1", today);

    expect(result.loginStreak).toBe(60);
    expect(result.bonusGranted).toBe(1);
    expect(mockPrisma.user.update).toHaveBeenCalled();
  });

  it("29日連続ではボーナスなし", async () => {
    const yesterday = new Date("2026-03-28");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 28, loginBestStreak: 28, lastLoginDate: yesterday }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);

    const result = await recordLoginActivity("child-1", today);

    expect(result.bonusGranted).toBe(0);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });
});
