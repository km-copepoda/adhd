import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/monster/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock as mockPrisma } from "../../helpers/prisma-mock";
import { childUserWithFamily, questWithTemplate } from "../../helpers/fixtures";

const mockGetCurrentUser = vi.mocked(getCurrentUser);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/monster", () => {
  it("未認証の場合、401を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it("モンスター情報を正しく返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(
      childUserWithFamily({ evolutionStage: 1, studyPt: 10, staminaPt: 5, lifePt: 3, evolutionPath: "STUDY" }),
    );
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();

    expect(json.name).toBe("ドラゴン");
    expect(json.evolutionStage).toBe(1);
    expect(json.studyPt).toBe(10);
    expect(json.staminaPt).toBe(5);
    expect(json.lifePt).toBe(3);
    expect(json.pendingStudyPt).toBe(0);
    expect(json.pendingStaminaPt).toBe(0);
    expect(json.pendingLifePt).toBe(0);
    expect(json.side).toBeDefined();
    expect(json.usedEggBonuses).toBeDefined();
  });

  it("usedEggBonusesを正しく返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(
      childUserWithFamily({ usedEggBonuses: '["STUDY","STAMINA"]' }),
    );
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();

    expect(json.usedEggBonuses).toBe('["STUDY","STAMINA"]');
  });

  it("承認待ちクエストのpendingXPを正しく集計すること", async () => {
    mockGetCurrentUser.mockResolvedValue(
      childUserWithFamily({ monsterName: "ピカ", studyPt: 5, staminaPt: 3, lifePt: 1 }),
    );

    mockPrisma.questInstance.findMany.mockResolvedValue([
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
    ]);

    const res = await GET();
    const json = await res.json();

    expect(json.pendingStudyPt).toBe(3);   // 1+2
    expect(json.pendingStaminaPt).toBe(1); // 1
    expect(json.pendingLifePt).toBe(2);    // 2
  });

  it("monsterNameがnullの場合、nameにフォールバックすること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily({ monsterName: null }));
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();

    expect(json.name).toBe("太郎");
  });

  it("monsterNameもnameもnullの場合、デフォルト名を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(
      childUserWithFamily({ monsterName: null, name: null }),
    );
    mockPrisma.questInstance.findMany.mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();

    expect(json.name).toBe("ぼうけんしゃ");
    expect(json.evolutionPath).toBeDefined();
  });

  it("REPORTEDステータスのクエストのみ集計すること", async () => {
    mockGetCurrentUser.mockResolvedValue(
      childUserWithFamily({ monsterName: "テスト", side: "DARK" }),
    );

    await GET();

    expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith({
      where: { childId: "child-1", status: "REPORTED" },
      include: { template: true },
    });
  });
});
