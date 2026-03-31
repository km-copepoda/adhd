import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { POST } from "@/app/api/streak/login-check/route";
import { childUser, streak, parentUser } from "../../helpers/fixtures";

// todayJST を固定日付に差し替えてタイムゾーン依存を排除
vi.mock("@/lib/date", () => ({
  todayJST: () => new Date("2026-03-29"),
}));

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

  it("10日目にボーナスが付与されること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    // todayJST = 2026-03-29 なので yesterday = 2026-03-28
    const yesterday = new Date("2026-03-28");
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 9, loginBestStreak: 9, lastLoginDate: yesterday }) as any,
    );
    mockPrisma.streak.update.mockResolvedValue({} as any);
    mockPrisma.user.findUnique.mockResolvedValue(
      // stage 1 を使い進化が発動しない範囲に設定
      childUser({ evolutionStage: 1, evolutionPath: "STUDY", studyPt: 2, staminaPt: 2, lifePt: 2 }) as any,
    );
    mockPrisma.user.update.mockResolvedValue({} as any);

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.loginStreak).toBe(10);
    expect(json.bonusGranted).toBe(1);
  });
});
