import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { GET } from "@/app/api/streak/route";
import { childUser, streak } from "../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
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
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.streak.findUnique.mockResolvedValue(null);
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.currentStreak).toBe(0);
    expect(json.bestStreak).toBe(0);
    expect(json.monthlyDays).toBe(0);
    expect(json.currentTitle).toBeNull();
    expect(json.restPassAvailable).toBe(true);
  });

  it("ストリーク情報を正しく返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser() as any);
    mockPrisma.streak.findUnique.mockResolvedValue(
      streak({
        currentStreak: 7,
        bestStreak: 15,
        lastAchievedDate: new Date("2026-03-13"),
      }) as any
    );
    mockPrisma.questInstance.findMany.mockResolvedValue([
      { date: new Date("2026-03-01") },
      { date: new Date("2026-03-05") },
      { date: new Date("2026-03-10") },
    ] as any);

    const res = await GET();
    const json = await res.json();

    expect(json.currentStreak).toBe(7);
    expect(json.bestStreak).toBe(15);
    expect(json.monthlyDays).toBe(3);
    expect(json.currentTitle).toEqual({ title: "一週間の戦士", emoji: "⚔️" });
  });
});
