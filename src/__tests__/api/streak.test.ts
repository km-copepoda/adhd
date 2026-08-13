import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentUser } from "@/lib/auth";
import { GET } from "@/app/api/streak/route";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import { childUserWithFamily, streak, questInstance } from "../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/streak", () => {
  it("未認証の場合、401を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("ストリーク未作成の場合、デフォルト値を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.streak.findUnique.mockResolvedValue(null);
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.currentStreak).toBe(0);
    expect(json.bestStreak).toBe(0);
    expect(json.monthlyDays).toBe(0);
    expect(json.currentTitle).toBeNull();
  });

  it("ストリーク情報を正しく返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.streak.findUnique.mockResolvedValue(
      streak({
        currentStreak: 7,
        bestStreak: 15,
        lastAchievedDate: new Date("2026-03-13"),
      })
    );
    mockPrisma.questInstance.findMany.mockResolvedValue([
      questInstance({ id: "q-1", date: new Date("2026-03-01") }),
      questInstance({ id: "q-2", date: new Date("2026-03-05") }),
      questInstance({ id: "q-3", date: new Date("2026-03-10") }),
    ]);

    const res = await GET();
    const json = await res.json();

    expect(json.currentStreak).toBe(7);
    expect(json.bestStreak).toBe(15);
    expect(json.monthlyDays).toBe(3);
    expect(json.currentTitle).toEqual({ title: "一週間の戦士", emoji: "⚔️" });
  });
});
