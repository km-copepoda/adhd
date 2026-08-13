import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/monster-status/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import {
  childUserWithFamily,
  streak,
  questWithTemplate,
  questInstance,
  questDeclaration,
} from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/monster-status", () => {
  it("未認証の場合、401を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("モンスター情報とストリーク情報を1レスポンスで返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(
      childUserWithFamily({ evolutionStage: 2, studyPt: 10, staminaPt: 5, lifePt: 3, evolutionPath: "STUDY_STAMINA" }),
    );
    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([])       // pendingQuests
      .mockResolvedValueOnce([]);      // monthlyQuests
    mockPrisma.streak.findUnique.mockResolvedValue(
      streak({ currentStreak: 7, bestStreak: 15, lastAchievedDate: new Date("2026-03-13") }),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();

    // monster fields
    expect(json.evolutionStage).toBe(2);
    expect(json.evolutionPath).toBe("STUDY_STAMINA");
    expect(json.side).toBeDefined();
    expect(json.studyPt).toBe(10);
    expect(json.staminaPt).toBe(5);
    expect(json.lifePt).toBe(3);
    expect(json.pendingStudyPt).toBe(0);
    expect(json.pendingStaminaPt).toBe(0);
    expect(json.pendingLifePt).toBe(0);

    // streak fields
    expect(json.currentStreak).toBe(7);
    expect(json.bestStreak).toBe(15);
    expect(json.monthlyDays).toBe(0);
    expect(json.lastAchievedDate).toBe("2026-03-13");
  });

  it("承認待ちクエストのpendingXPをカテゴリ別に集計すること", async () => {
    mockGetCurrentUser.mockResolvedValue(
      childUserWithFamily({ monsterName: "ピカ", studyPt: 5, staminaPt: 3, lifePt: 1 }),
    );
    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([
        // snapshotCategory は未設定（旧データ状態を再現）: template.category へフォールバックさせる
        questWithTemplate(
          { id: "q1", deadlineBonusEarned: false, photoUrl: null, snapshotCategory: undefined },
          { category: "STUDY", photoBonus: false },
        ), // +1
        questWithTemplate(
          { id: "q2", deadlineBonusEarned: true, photoUrl: null, snapshotCategory: undefined },
          { category: "STUDY", photoBonus: false },
        ), // +2
        questWithTemplate(
          { id: "q3", deadlineBonusEarned: false, photoUrl: null, snapshotCategory: undefined },
          { category: "STAMINA", photoBonus: false },
        ), // +1
        questWithTemplate(
          { id: "q4", deadlineBonusEarned: false, photoUrl: "url", snapshotCategory: undefined },
          { category: "LIFE", photoBonus: true },
        ), // +2
      ])
      .mockResolvedValueOnce([]); // monthlyQuests
    mockPrisma.streak.findUnique.mockResolvedValue(null);

    const res = await GET();
    const json = await res.json();

    expect(json.pendingStudyPt).toBe(3);   // 1+2
    expect(json.pendingStaminaPt).toBe(1); // 1
    expect(json.pendingLifePt).toBe(2);    // 2
  });

  it("「今日やる宣言」つきの REPORTED クエストは pendingXP に宣言ボーナスを含めること", async () => {
    // regression: 育成画面の「+ N (仮)」とクエスト画面のタイル個別 +xpXP が乖離していたバグ
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const reportedAt = new Date("2026-05-24T10:00:00+09:00"); // JST 2026-05-24
    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([
        questWithTemplate(
          {
            templateId: "t1",
            reportedAt,
            deadlineBonusEarned: true,
            photoUrl: null,
            // snapshotCategory は未設定（旧データ状態を再現）: template.category へフォールバックさせる。
            // 実スキーマでは snapshotCategory は必須（非 null）だが、旧 `as any` テストが
            // `null` を渡していたのは「フィールド欠落状態」を意図したもの。フィクスチャの
            // Partial<QuestInstance> では undefined でこれを表現する。
            snapshotCategory: undefined,
          },
          { photoBonus: false, category: "STUDY" },
        ),
      ])
      .mockResolvedValueOnce([]);
    mockPrisma.questDeclaration.findMany.mockResolvedValue([
      questDeclaration({ templateId: "t1", date: new Date("2026-05-24T00:00:00Z") }),
    ]);
    mockPrisma.streak.findUnique.mockResolvedValue(null);

    const res = await GET();
    const json = await res.json();

    expect(json.pendingStudyPt).toBe(3); // 1 base + 1 deadline + 1 declaration
  });

  it("今月の達成日数を正しく返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.questInstance.findMany
      .mockResolvedValueOnce([]) // pendingQuests
      .mockResolvedValueOnce([
        questInstance({ date: new Date("2026-03-01") }),
        questInstance({ date: new Date("2026-03-05") }),
        questInstance({ date: new Date("2026-03-10") }),
      ]);
    mockPrisma.streak.findUnique.mockResolvedValue(null);

    const res = await GET();
    const json = await res.json();

    expect(json.monthlyDays).toBe(3);
  });

  it("ストリーク未作成の場合、デフォルト値を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.questInstance.findMany.mockResolvedValue([]);
    mockPrisma.streak.findUnique.mockResolvedValue(null);

    const res = await GET();
    const json = await res.json();

    expect(json.currentStreak).toBe(0);
    expect(json.bestStreak).toBe(0);
    expect(json.monthlyDays).toBe(0);
    expect(json.currentTitle).toBeNull();
    expect(json.lastAchievedDate).toBeNull();
  });

  it("REPORTEDクエストのみpending集計に使用すること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    mockPrisma.questInstance.findMany.mockResolvedValue([]);
    mockPrisma.streak.findUnique.mockResolvedValue(null);

    await GET();

    // 1回目の呼び出しがpendingQuests (status=REPORTED)
    expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { childId: "child-1", status: "REPORTED" },
        include: { template: true },
      }),
    );
  });
});
