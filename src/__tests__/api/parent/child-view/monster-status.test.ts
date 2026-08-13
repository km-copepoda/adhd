import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/parent/child-view/monster-status/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../../helpers/prisma-mock";
import {
  parentUserWithFamily,
  childUserWithFamily,
  childUser,
  streak,
  questWithTemplate,
  questInstance,
} from "../../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

function makeReq(childId?: string) {
  const url = childId !== undefined
    ? `http://localhost/api/parent/child-view/monster-status?childId=${childId}`
    : "http://localhost/api/parent/child-view/monster-status";
  return new Request(url);
}

describe("GET /api/parent/child-view/monster-status", () => {
  it("未認証の場合、401 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(401);
  });

  it("CHILD ロールの場合、403 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(403);
  });

  it("childId 未指定の場合、400 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await GET(makeReq(""));
    expect(res.status).toBe(400);
  });

  it("別 family の子を指定された場合、404 を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq("child-other"));
    expect(res.status).toBe(404);
  });

  it("正常系: モンスター・ストリーク・月間達成を返す", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(
      childUser({
        id: "child-1",
        name: "太郎",
        monsterName: "ドラゴン",
        evolutionStage: 2,
        evolutionPath: "STUDY",
        studyPt: 5,
        staminaPt: 3,
        lifePt: 2,
      }),
    );
    mockPrisma.questInstance.findMany.mockResolvedValueOnce([]); // pending REPORTED
    mockPrisma.streak.findUnique.mockResolvedValue(
      streak({
        currentStreak: 7,
        bestStreak: 10,
        lastAchievedDate: new Date("2026-03-11"),
      }),
    );
    // `select: { date: true }` クエリでも mockResolvedValue はベースの QuestInstance 完全型を要求するため、
    // questInstance フィクスチャで完全な値を用意する（実装は select で絞るので余剰フィールドは無視される）。
    const monthlyQuests = [
      questInstance({ date: new Date("2026-03-10") }),
      questInstance({ date: new Date("2026-03-11") }),
    ];
    mockPrisma.questInstance.findMany.mockResolvedValueOnce(monthlyQuests);

    const res = await GET(makeReq("child-1"));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.name).toBe("ドラゴン");
    expect(json.evolutionStage).toBe(2);
    expect(json.evolutionPath).toBe("STUDY");
    expect(json.studyPt).toBe(5);
    expect(json.currentStreak).toBe(7);
    expect(json.bestStreak).toBe(10);
    expect(json.monthlyDays).toBe(2);
  });

  it("REPORTED の pending XP を集計してカテゴリ別 pending* に入れる", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    mockPrisma.user.findFirst.mockResolvedValue(childUser({ id: "child-1" }));
    mockPrisma.questInstance.findMany.mockResolvedValueOnce([
      questWithTemplate(
        { id: "q1", deadlineBonusEarned: false, photoUrl: null, snapshotCategory: "STUDY" },
        { category: "STUDY", photoBonus: false },
      ),
      questWithTemplate(
        { id: "q2", deadlineBonusEarned: true, photoUrl: null, snapshotCategory: "STAMINA" },
        { category: "STAMINA", photoBonus: false },
      ),
    ]);
    mockPrisma.streak.findUnique.mockResolvedValue(null);
    mockPrisma.questInstance.findMany.mockResolvedValueOnce([]);

    const res = await GET(makeReq("child-1"));
    const json = await res.json();
    expect(json.pendingStudyPt).toBe(1);
    expect(json.pendingStaminaPt).toBe(2); // 1 base + 1 deadline
    expect(json.pendingLifePt).toBe(0);
  });
});
