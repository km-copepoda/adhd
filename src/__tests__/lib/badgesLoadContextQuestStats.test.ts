// Issue #161: loadBadgeContext が QuestInstance を全件取得せず、DB 集計（groupBy / count）と
// 「APPROVED かつ reportedAt != null 行の reportedAt, createdAt だけの findMany」で組み立てること、
// かつ結果が集計化前の実装（参照実装）と完全に同値であることの検証。
//
// questInstance.findMany / count / groupBy は src/__tests__/helpers/badgeContextReference.ts の
// インメモリ評価器（SQL の三値論理で where を評価）に差し替える。実装がどの where の書き方
// （not: null / NOT: {photoUrl: ""} / notIn など）を選んでも、意味が正しければ通る。
// $queryRaw は使わない方針（案B）なので、$queryRaw が呼ばれたら失敗させる。

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadBadgeContext } from "@/lib/badges";
import { checkBadgeConditions } from "@/lib/badges.data";
import { prismaMock as mockPrisma } from "../helpers/prisma-mock";
import { childUser } from "../helpers/fixtures";
import {
  QUEST_KEYS,
  pickQuestStats,
  quest,
  randomQuestRows,
  referenceQuestStats,
  dateRange,
  wireQuestInstanceDb,
  type QuestRow,
} from "../helpers/badgeContextReference";

const NOW = "2026-06-15T03:00:00Z"; // JST 2026-06-15 12:00
const TODAY = "2026-06-15";

function wire(rows: QuestRow[]) {
  wireQuestInstanceDb(mockPrisma.questInstance, rows);
}

function baseline() {
  mockPrisma.user.findUnique.mockResolvedValue(
    childUser({ evolutionStage: 1, collectedPaths: "[]", studyPt: 0, staminaPt: 0, lifePt: 0, usedEggBonuses: "[]" }),
  );
  mockPrisma.streak.findUnique.mockResolvedValue(null);
  mockPrisma.taskStreak.findMany.mockResolvedValue([]);
  mockPrisma.taskTemplate.count.mockResolvedValue(0);
  mockPrisma.userBadge.count.mockResolvedValue(0);
  mockPrisma.treasureLog.findMany.mockResolvedValue([]);
  mockPrisma.userCollectionItem.findMany.mockResolvedValue([]);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
  baseline();
  wire([]);
});

afterEach(() => {
  vi.useRealTimers();
});

async function statsFromDb(rows: QuestRow[]) {
  wire(rows);
  const ctx = await loadBadgeContext("c1");
  return { ctx, stats: pickQuestStats(ctx) };
}

describe("loadBadgeContext: QuestInstance 全件取得の撤廃", () => {
  it("childId だけで全列を取る旧 findMany は呼ばれず、新 findMany は APPROVED+reportedAt!=null の2列だけ", async () => {
    const rows = [quest("2026-06-10"), quest("2026-06-11", { status: "REPORTED" })];
    await statsFromDb(rows);

    for (const [args] of mockPrisma.questInstance.findMany.mock.calls) {
      const a = args as Record<string, unknown>;
      const where = a.where as Record<string, unknown>;
      expect(where.status).toBe("APPROVED");
      expect(where.reportedAt).toEqual({ not: null });
      expect(Object.keys(a.select as object).sort()).toEqual(["createdAt", "reportedAt"]);
      expect(a.orderBy).toBeUndefined();
      expect(a.include).toBeUndefined();
    }
    // 時刻系の取得は1回で足りる
    expect(mockPrisma.questInstance.findMany.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("$queryRaw / $queryRawUnsafe は使わない", async () => {
    await statsFromDb([quest("2026-06-10")]);
    expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("0件: 全項目 0/false、maxQuestsPerDay=0（Math.max(0, ...[]) 相当）", async () => {
    const { stats } = await statsFromDb([]);
    expect(stats).toEqual(referenceQuestStats([], TODAY));
    expect(stats.maxQuestsPerDay).toBe(0);
    expect(stats.totalXp).toBe(0);
  });

  it("1件（APPROVED）: approvedCount=1, totalXp=1", async () => {
    const { stats } = await statsFromDb([quest("2026-06-10")]);
    expect(stats.approvedCount).toBe(1);
    expect(stats.totalXp).toBe(1);
    expect(stats.maxQuestsPerDay).toBe(1);
  });
});

describe("loadBadgeContext: 空文字・null の扱い（truthy 判定と同値）", () => {
  it("photoUrl: null / 空文字は photoCount・photoBonus XP に数えない、値ありは数える", async () => {
    const mk = (photoUrl: string | null) => quest("2026-06-10", { photoUrl, template: { photoBonus: true } });
    const { stats } = await statsFromDb([mk(null), mk(""), mk("https://x/a.png")]);
    expect(stats.photoCount).toBe(1);
    expect(stats.totalXp).toBe(3 + 1); // 承認3 + 写真ボーナス1
  });

  it("photoBonus=false の写真ありは XP 加算なし", async () => {
    const { stats } = await statsFromDb([quest("2026-06-10", { photoUrl: "u", template: { photoBonus: false } })]);
    expect(stats.photoCount).toBe(1);
    expect(stats.totalXp).toBe(1);
  });

  it("rejectionReason: null / 空文字は retry に数えない、REJECTED 行も数えない", async () => {
    const { stats } = await statsFromDb([
      quest("2026-06-10", { rejectionReason: "NG" }),
      quest("2026-06-10", { rejectionReason: "" }),
      quest("2026-06-10", { rejectionReason: null }),
      quest("2026-06-10", { status: "REJECTED", rejectionReason: "NG" }),
    ]);
    expect(stats.retrySuccessCount).toBe(1);
  });

  it("REPORTED/SKIPPED の期限ボーナス true は数えない", async () => {
    const { stats } = await statsFromDb([
      quest("2026-06-10", { deadlineBonusEarned: true }),
      quest("2026-06-10", { status: "REPORTED", deadlineBonusEarned: true }),
      quest("2026-06-10", { status: "SKIPPED", deadlineBonusEarned: true }),
    ]);
    expect(stats.deadlineBonusCount).toBe(1);
  });
});

describe("loadBadgeContext: 速報（30分未満）の境界", () => {
  const at = (diffMs: number | null) => {
    const reportedAt = new Date("2026-06-10T03:00:00Z");
    return quest("2026-06-10", {
      reportedAt: diffMs === null ? null : reportedAt,
      createdAt: new Date(reportedAt.getTime() - (diffMs ?? 0)),
    });
  };
  const MIN30 = 30 * 60 * 1000;

  it("29分59.999秒 → 数える", async () => {
    expect((await statsFromDb([at(MIN30 - 1)])).stats.quickReportCount).toBe(1);
  });
  it("ちょうど30分 → 数えない", async () => {
    expect((await statsFromDb([at(MIN30)])).stats.quickReportCount).toBe(0);
  });
  it("負の差（reportedAt < createdAt）→ 数える（現行仕様）", async () => {
    expect((await statsFromDb([at(-60 * 1000)])).stats.quickReportCount).toBe(1);
  });
  it("0ミリ秒差 → 数える", async () => {
    expect((await statsFromDb([at(0)])).stats.quickReportCount).toBe(1);
  });
  it("reportedAt が null の APPROVED は数えない（時間帯にも入れない）", async () => {
    const { stats } = await statsFromDb([at(null)]);
    expect(stats.quickReportCount).toBe(0);
    expect(stats.morningReportCount).toBe(0);
    expect(stats.afternoonReportCount).toBe(0);
    expect(stats.approvedCount).toBe(1); // 承認自体は数える
  });
  it("APPROVED 以外の速報は数えない", async () => {
    const r = at(1000);
    expect((await statsFromDb([{ ...r, status: "REPORTED" }])).stats.quickReportCount).toBe(0);
  });
});

describe("loadBadgeContext: 時間帯（JST）の境界", () => {
  // JST = UTC+9
  const rep = (utcIso: string) =>
    quest("2026-06-10", { reportedAt: new Date(utcIso), createdAt: new Date(new Date(utcIso).getTime() - 2 * 3600 * 1000) });

  it.each([
    ["JST 00:00 (UTC前日15:00)", "2026-06-09T15:00:00.000Z", 1, 0],
    ["JST 07:00 (UTC前日22:00 = 日付またぎ)", "2026-06-09T22:00:00.000Z", 1, 0],
    ["JST 07:59:59.999", "2026-06-09T22:59:59.999Z", 1, 0],
    ["JST 08:00:00.000", "2026-06-09T23:00:00.000Z", 0, 0],
    ["JST 14:59:59.999", "2026-06-10T05:59:59.999Z", 0, 0],
    ["JST 15:00:00.000", "2026-06-10T06:00:00.000Z", 0, 1],
    ["JST 17:59:59.999", "2026-06-10T08:59:59.999Z", 0, 1],
    ["JST 18:00:00.000", "2026-06-10T09:00:00.000Z", 0, 0],
    ["JST 23:59:59.999", "2026-06-10T14:59:59.999Z", 0, 0],
  ])("%s → morning=%i afternoon=%i", async (_label, iso, morning, afternoon) => {
    const { stats } = await statsFromDb([rep(iso)]);
    expect(stats.morningReportCount).toBe(morning);
    expect(stats.afternoonReportCount).toBe(afternoon);
  });

  it("APPROVED 以外の行は時間帯に数えない", async () => {
    const { stats } = await statsFromDb([{ ...rep("2026-06-09T22:00:00.000Z"), status: "REPORTED" }]);
    expect(stats.morningReportCount).toBe(0);
  });
});

describe("loadBadgeContext: todayStr（JST 日付）境界", () => {
  const rows = () => [quest("2026-06-14"), quest("2026-06-15")];

  it("JST 06-14 23:59:59（UTC 14:59:59）: 06-14 はまだ当日なので perfect に含めない", async () => {
    vi.setSystemTime(new Date("2026-06-14T14:59:59.000Z"));
    expect((await statsFromDb(rows())).stats.perfectDaysCount).toBe(0);
  });
  it("JST 06-15 00:00:00（UTC 15:00:00）: 06-14 は過去になり数える。06-15 は当日で数えない", async () => {
    vi.setSystemTime(new Date("2026-06-14T15:00:00.000Z"));
    expect((await statsFromDb(rows())).stats.perfectDaysCount).toBe(1);
  });
  it("JST 06-15 23:59:59: 06-15 はまだ当日", async () => {
    vi.setSystemTime(new Date("2026-06-15T14:59:59.000Z"));
    expect((await statsFromDb(rows())).stats.perfectDaysCount).toBe(1);
  });
  it("未来日付は数えない", async () => {
    expect((await statsFromDb([quest("2026-06-16")])).stats.perfectDaysCount).toBe(0);
  });
  it("date の @db.Date（UTC 0:00）は変換されず YYYY-MM-DD として扱われる（月曜判定）", async () => {
    // 2026-06-01 は月曜。タイムゾーン変換が入ると日曜(5/31)にずれる
    const { stats } = await statsFromDb([quest("2026-06-01")]);
    expect(stats.mondayCount).toBe(1);
    expect(stats.weekendCount).toBe(0);
  });
});

describe("loadBadgeContext: 参照実装との完全同値（ランダム / 大量）", () => {
  it.each([11, 12, 13, 14, 15, 16])("ランダム seed=%i（900件・全ステータス・空文字・負の時間差混在）", async (seed) => {
    const rows = randomQuestRows(seed, 900);
    const { ctx, stats } = await statsFromDb(rows);
    expect(stats).toEqual(referenceQuestStats(rows, TODAY));
    const expectedCtx = { ...ctx, ...referenceQuestStats(rows, TODAY) };
    expect([...checkBadgeConditions(ctx)].sort()).toEqual([...checkBadgeConditions(expectedCtx)].sort());
  });

  it("5年・毎日・複数件の大量データ（3,000件超）", async () => {
    const rows = dateRange("2021-01-01", 365 * 5).flatMap((d, i) => [
      quest(d, { deadlineBonusEarned: i % 2 === 0, photoUrl: i % 3 === 0 ? "u" : null }),
      quest(d, { status: i % 5 === 0 ? "SKIPPED" : "APPROVED" }),
    ]);
    expect(rows.length).toBeGreaterThan(3000);
    const { stats } = await statsFromDb(rows);
    expect(stats).toEqual(referenceQuestStats(rows, TODAY));
  });

  it("全 QUEST_KEYS が ctx に存在する（欠落なし）", async () => {
    const { ctx } = await statsFromDb([quest("2026-06-10")]);
    for (const k of QUEST_KEYS) expect(ctx).toHaveProperty(k);
  });
});
