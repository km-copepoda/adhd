import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/quests/monthly-summary/route";
import { getCurrentUser } from "@/lib/auth";
import { prismaMock } from "../../helpers/prisma-mock";
import { parentUserWithFamily, childUserWithFamily, questInstance } from "../../helpers/fixtures";
/**
 * questInstance.findMany(select: { date, status, deadlineBonusEarned, photoUrl,
 * template: { select: { photoBonus } } }) 相当。
 * DeepMockProxy の mockResolvedValue は select 限定の Prisma.XGetPayload ではなく
 * ベースの QuestInstance 完全型を要求するため、questInstance() フィクスチャで
 * 他フィールドを埋めた上で template select を追加する。
 */
function monthlyInstance(overrides: Parameters<typeof questInstance>[0], photoBonus: boolean) {
  return { ...questInstance(overrides), template: { photoBonus } };
}

const mockGetCurrentUser = vi.mocked(getCurrentUser);

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/quests/monthly-summary");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/quests/monthly-summary", () => {
  it("未認証の場合、空レスポンスを返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeRequest({ year: "2026", month: "4", childId: "child-1" }));
    const json = await res.json();
    expect(json.achievedDays).toBe(0);
    expect(json.totalApproved).toBe(0);
    expect(json.totalXp).toBe(0);
    expect(json.days).toEqual({});
  });

  it("CHILDロールの場合、空レスポンスを返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(childUserWithFamily());
    const res = await GET(makeRequest({ year: "2026", month: "4", childId: "child-1" }));
    const json = await res.json();
    expect(json.achievedDays).toBe(0);
  });

  it("familyIdがない場合、空レスポンスを返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily({ familyId: null }));
    const res = await GET(makeRequest({ year: "2026", month: "4", childId: "child-1" }));
    const json = await res.json();
    expect(json.achievedDays).toBe(0);
  });

  it("childIdが欠けている場合、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await GET(makeRequest({ year: "2026", month: "4" }));
    expect(res.status).toBe(400);
  });

  it("yearが欠けている場合、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await GET(makeRequest({ month: "4", childId: "child-1" }));
    expect(res.status).toBe(400);
  });

  it("monthが欠けている場合、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await GET(makeRequest({ year: "2026", childId: "child-1" }));
    expect(res.status).toBe(400);
  });

  it("monthが13の場合（範囲外）、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await GET(makeRequest({ year: "2026", month: "13", childId: "child-1" }));
    expect(res.status).toBe(400);
  });

  it("monthが0の場合（範囲外）、400を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    const res = await GET(makeRequest({ year: "2026", month: "0", childId: "child-1" }));
    expect(res.status).toBe(400);
  });

  it("APPROVEDクエストを日別に集計すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([
      monthlyInstance(
        { date: new Date("2026-04-01T00:00:00Z"), status: "APPROVED", deadlineBonusEarned: false, photoUrl: null },
        false,
      ),
      monthlyInstance(
        { date: new Date("2026-04-01T00:00:00Z"), status: "APPROVED", deadlineBonusEarned: false, photoUrl: null },
        false,
      ),
      monthlyInstance(
        { date: new Date("2026-04-02T00:00:00Z"), status: "APPROVED", deadlineBonusEarned: false, photoUrl: null },
        false,
      ),
    ]);

    const res = await GET(makeRequest({ year: "2026", month: "4", childId: "child-1" }));
    const json = await res.json();

    expect(json.days["2026-04-01"].approved).toBe(2);
    expect(json.days["2026-04-01"].skipped).toBe(0);
    expect(json.days["2026-04-01"].total).toBe(2);
    expect(json.days["2026-04-02"].approved).toBe(1);
    expect(json.days["2026-04-02"].total).toBe(1);
    expect(json.totalApproved).toBe(3);
  });

  it("SKIPPEDクエストを日別に集計すること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([
      monthlyInstance(
        { date: new Date("2026-04-03T00:00:00Z"), status: "SKIPPED", deadlineBonusEarned: false, photoUrl: null },
        false,
      ),
    ]);

    const res = await GET(makeRequest({ year: "2026", month: "4", childId: "child-1" }));
    const json = await res.json();

    expect(json.days["2026-04-03"].skipped).toBe(1);
    expect(json.days["2026-04-03"].approved).toBe(0);
    expect(json.days["2026-04-03"].total).toBe(1);
  });

  it("PENDINGはtotalにカウントされapproved/skippedにはカウントされないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([
      monthlyInstance(
        { date: new Date("2026-04-01T00:00:00Z"), status: "APPROVED", deadlineBonusEarned: false, photoUrl: null },
        false,
      ),
      monthlyInstance(
        { date: new Date("2026-04-01T00:00:00Z"), status: "PENDING", deadlineBonusEarned: false, photoUrl: null },
        false,
      ),
    ]);

    const res = await GET(makeRequest({ year: "2026", month: "4", childId: "child-1" }));
    const json = await res.json();

    expect(json.days["2026-04-01"].total).toBe(2);
    expect(json.days["2026-04-01"].approved).toBe(1);
    expect(json.days["2026-04-01"].skipped).toBe(0);
  });

  it("REPORTED/SKIP_REPORTEDもtotalにカウントされること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([
      monthlyInstance(
        { date: new Date("2026-04-02T00:00:00Z"), status: "REPORTED", deadlineBonusEarned: false, photoUrl: null },
        false,
      ),
      monthlyInstance(
        { date: new Date("2026-04-02T00:00:00Z"), status: "SKIP_REPORTED", deadlineBonusEarned: false, photoUrl: null },
        false,
      ),
    ]);

    const res = await GET(makeRequest({ year: "2026", month: "4", childId: "child-1" }));
    const json = await res.json();

    expect(json.days["2026-04-02"].total).toBe(2);
    expect(json.days["2026-04-02"].approved).toBe(0);
    expect(json.days["2026-04-02"].skipped).toBe(0);
  });

  it("REJECTEDはtotalにカウントされないこと（無効化されたタスク）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    // REJECTEDはクエリで除外されるためmockには含まれない想定
    // クエリにstatus: { notIn: ["REJECTED"] }が含まれることを確認
    prismaMock.questInstance.findMany.mockResolvedValue([
      monthlyInstance(
        { date: new Date("2026-04-01T00:00:00Z"), status: "APPROVED", deadlineBonusEarned: false, photoUrl: null },
        false,
      ),
    ]);

    await GET(makeRequest({ year: "2026", month: "4", childId: "child-1" }));

    expect(prismaMock.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { notIn: ["REJECTED"] },
        }),
      })
    );
  });

  it("achievedDaysはapproved >= 1の日数のみをカウントすること（SKIPPEDのみの日は含まない）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([
      monthlyInstance(
        { date: new Date("2026-04-01T00:00:00Z"), status: "APPROVED", deadlineBonusEarned: false, photoUrl: null },
        false,
      ),
      monthlyInstance(
        { date: new Date("2026-04-01T00:00:00Z"), status: "APPROVED", deadlineBonusEarned: false, photoUrl: null },
        false,
      ),
      monthlyInstance(
        { date: new Date("2026-04-03T00:00:00Z"), status: "APPROVED", deadlineBonusEarned: false, photoUrl: null },
        false,
      ),
      // SKIPPEDのみの日は達成にカウントしない
      monthlyInstance(
        { date: new Date("2026-04-05T00:00:00Z"), status: "SKIPPED", deadlineBonusEarned: false, photoUrl: null },
        false,
      ),
    ]);

    const res = await GET(makeRequest({ year: "2026", month: "4", childId: "child-1" }));
    const json = await res.json();

    expect(json.achievedDays).toBe(2); // 4/1 と 4/3
  });

  it("totalXpをcalcActualXPで正しく計算すること（期限ボーナス+写真ボーナス）", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([
      // +3pt: base(1) + deadline(1) + photo(1)
      monthlyInstance(
        {
          date: new Date("2026-04-01T00:00:00Z"),
          status: "APPROVED",
          deadlineBonusEarned: true,
          photoUrl: "https://example.com/photo.jpg",
        },
        true,
      ),
      // +1pt: base(1)
      monthlyInstance(
        { date: new Date("2026-04-01T00:00:00Z"), status: "APPROVED", deadlineBonusEarned: false, photoUrl: null },
        false,
      ),
    ]);

    const res = await GET(makeRequest({ year: "2026", month: "4", childId: "child-1" }));
    const json = await res.json();

    expect(json.totalXp).toBe(4); // 3 + 1
  });

  it("SKIPPEDクエストのXPはカウントしないこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([
      monthlyInstance(
        { date: new Date("2026-04-01T00:00:00Z"), status: "SKIPPED", deadlineBonusEarned: false, photoUrl: null },
        false,
      ),
    ]);

    const res = await GET(makeRequest({ year: "2026", month: "4", childId: "child-1" }));
    const json = await res.json();

    expect(json.totalXp).toBe(0);
  });

  it("月の範囲（4月なら4/1〜4/30、5/1は含まない）でクエリすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([]);

    await GET(makeRequest({ year: "2026", month: "4", childId: "child-1" }));

    expect(prismaMock.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: {
            gte: new Date("2026-04-01T00:00:00.000Z"),
            lt: new Date("2026-05-01T00:00:00.000Z"),
          },
        }),
      })
    );
  });

  it("2月（28日）の月末範囲が正しいこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([]);

    await GET(makeRequest({ year: "2026", month: "2", childId: "child-1" }));

    expect(prismaMock.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: {
            gte: new Date("2026-02-01T00:00:00.000Z"),
            lt: new Date("2026-03-01T00:00:00.000Z"),
          },
        }),
      })
    );
  });

  it("familyIdでテンプレートをフィルタすること", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([]);

    await GET(makeRequest({ year: "2026", month: "4", childId: "child-1" }));

    expect(prismaMock.questInstance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          childId: "child-1",
          template: { familyId: "fam-1" },
        }),
      })
    );
  });

  it("データなしの場合、空のdaysと0の統計を返すこと", async () => {
    mockGetCurrentUser.mockResolvedValue(parentUserWithFamily());
    prismaMock.questInstance.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest({ year: "2026", month: "4", childId: "child-1" }));
    const json = await res.json();

    expect(json.days).toEqual({});
    expect(json.achievedDays).toBe(0);
    expect(json.totalApproved).toBe(0);
    expect(json.totalXp).toBe(0);
  });
});
