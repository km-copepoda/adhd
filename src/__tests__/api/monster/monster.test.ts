import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/monster/route";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { childUser } from "../../helpers/fixtures";

const mockPrisma = vi.mocked(prisma);
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
      childUser({ evolutionStage: 1, studyPt: 10, staminaPt: 5, lifePt: 3, evolutionPath: "STUDY" }) as any,
    );
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

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
      { ...childUser(), usedEggBonuses: '["STUDY","STAMINA"]' } as any,
    );
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

    const res = await GET();
    const json = await res.json();

    expect(json.usedEggBonuses).toBe('["STUDY","STAMINA"]');
  });

  it("承認待ちクエストのpendingXPを正しく集計すること", async () => {
    mockGetCurrentUser.mockResolvedValue(
      childUser({ monsterName: "ピカ", studyPt: 5, staminaPt: 3, lifePt: 1 }) as any,
    );

    mockPrisma.questInstance.findMany.mockResolvedValue([
      { deadlineBonusEarned: false, photoUrl: null, template: { photoBonus: false, category: "STUDY" } },    // +1
      { deadlineBonusEarned: true, photoUrl: null, template: { photoBonus: false, category: "STUDY" } },     // +2
      { deadlineBonusEarned: false, photoUrl: null, template: { photoBonus: false, category: "STAMINA" } },  // +1
      { deadlineBonusEarned: false, photoUrl: "url", template: { photoBonus: true, category: "LIFE" } },     // +2
    ] as any);

    const res = await GET();
    const json = await res.json();

    expect(json.pendingStudyPt).toBe(3);   // 1+2
    expect(json.pendingStaminaPt).toBe(1); // 1
    expect(json.pendingLifePt).toBe(2);    // 2
  });

  it("monsterNameがnullの場合、nameにフォールバックすること", async () => {
    mockGetCurrentUser.mockResolvedValue(childUser({ monsterName: null }) as any);
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

    const res = await GET();
    const json = await res.json();

    expect(json.name).toBe("太郎");
  });

  it("monsterNameもnameもnullの場合、デフォルト名を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(
      childUser({ monsterName: null, name: null }) as any,
    );
    mockPrisma.questInstance.findMany.mockResolvedValue([] as any);

    const res = await GET();
    const json = await res.json();

    expect(json.name).toBe("ぼうけんしゃ");
    expect(json.evolutionPath).toBeDefined();
  });

  it("REPORTEDステータスのクエストのみ集計すること", async () => {
    mockGetCurrentUser.mockResolvedValue(
      childUser({ monsterName: "テスト", side: "DARK" }) as any,
    );

    await GET();

    expect(mockPrisma.questInstance.findMany).toHaveBeenCalledWith({
      where: { childId: "child-1", status: "REPORTED" },
      include: { template: true },
    });
  });
});
