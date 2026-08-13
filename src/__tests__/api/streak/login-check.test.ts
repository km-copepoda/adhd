import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentUser } from "@/lib/auth";
import { checkAndUnlockBadges } from "@/lib/badges";
import { triggerBadgeLog } from "@/lib/bulletinLog";
import { POST } from "@/app/api/streak/login-check/route";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { childUser, childUserWithFamily, streak, parentUserWithFamily } from "../../helpers/fixtures";

vi.mock("@/lib/badges", () => ({
  checkAndUnlockBadges: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/bulletinLog", () => ({
  triggerBadgeLog: vi.fn().mockResolvedValue(undefined),
}));

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const mockCheckAndUnlockBadges = vi.mocked(checkAndUnlockBadges);
const mockTriggerBadgeLog = vi.mocked(triggerBadgeLog);

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
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());

    const res = await POST();
    expect(res.status).toBe(403);
  });

  it("初回ログインで loginStreak=1 を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 0, loginBestStreak: 0, lastLoginDate: null }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.loginStreak).toBe(1);
    expect(json.bonusGranted).toBe(0);
  });

  it("10日目にボーナスが付与されること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    // recordLoginActivity と同じ JST ベースで yesterday を計算（タイムゾーン境界バグ防止）
    const jstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayNorm = new Date(Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()));
    const yesterday = new Date(todayNorm);
    yesterday.setDate(yesterday.getDate() - 1);
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 9, loginBestStreak: 9, lastLoginDate: yesterday }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());
    mockPrisma.user.findUnique.mockResolvedValue(
      // stage 1 を使い進化が発動しない範囲に設定
      childUser({ evolutionStage: 1, evolutionPath: "STUDY", studyPt: 2, staminaPt: 2, lifePt: 2 }),
    );
    mockPrisma.user.update.mockResolvedValue(childUser());

    const res = await POST();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.loginStreak).toBe(10);
    expect(json.bonusGranted).toBe(1);
  });

  it("ログインで新規解除されたバッジを掲示板に流すこと（triggerBadgeLog 呼び出し）", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.streak.upsert.mockResolvedValue(
      streak({ loginCurrentStreak: 0, loginBestStreak: 0, lastLoginDate: null }),
    );
    mockPrisma.streak.update.mockResolvedValue(streak());
    mockCheckAndUnlockBadges.mockResolvedValue([
      { id: "login_14", name: "2週間ログイン", emoji: "🌿", description: "ログインストリーク14日" },
    ]);

    await POST();
    // after() は setup.ts で即時実行モック化されているので await は不要
    await new Promise((r) => setImmediate(r));

    expect(mockTriggerBadgeLog).toHaveBeenCalledWith("child-1", "2週間ログイン");
  });
});
