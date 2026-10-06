// Issue #161: loadBadgeContext の QuestInstance 集計化に対する「参照実装」とテスト用ヘルパー。
//
// referenceQuestStats は、集計化前の src/lib/badges.ts の loadBadgeContext が
// 「全 QuestInstance 行」に対して直接 filter / group していた処理の写し。
// 新実装（DB 集計 + buildQuestBadgeStats）の出力がこれと完全一致することを検証する。
// 本番コードをここから import してはならない（参照実装が本番と同じバグを持つのを避けるため）。

import type { BadgeContext } from "@/lib/badges.data";

export type QuestRow = {
  id: string;
  childId: string;
  date: Date; // @db.Date: JST 日付を UTC 0:00 で保存
  status: string;
  photoUrl: string | null;
  deadlineBonusEarned: boolean;
  rejectionReason: string | null;
  reportedAt: Date | null;
  createdAt: Date;
  template: { photoBonus: boolean };
};

/** QuestInstance 由来の BadgeContext 項目（totalXp を含む） */
export const QUEST_KEYS = [
  "totalXp",
  "approvedCount",
  "photoCount",
  "deadlineBonusCount",
  "quickReportCount",
  "morningReportCount",
  "afternoonReportCount",
  "retrySuccessCount",
  "skipCount",
  "skipThenNextDayCount",
  "perfectDaysCount",
  "maxQuestsPerDay",
  "weeksWithFivePlusDays",
  "weeksWithSevenDays",
  "monthsWithTenPlusDays",
  "monthsWithFifteenPlusDays",
  "monthsWithTwentyPlusDays",
  "perfectMonthsCount",
  "springDays",
  "summerDays",
  "autumnDays",
  "winterDays",
  "hasNewYearQuest",
  "monthEndCount",
  "mondayCount",
  "weekendCount",
  "hasComeback7",
  "hasComeback14",
  "hasComeback7After2Breaks",
  "hasMagicDay",
  "hasWeekWithDailyDeadline",
  "tripleCrownDaysCount",
] as const satisfies readonly (keyof BadgeContext)[];

export type QuestStats = Pick<BadgeContext, (typeof QUEST_KEYS)[number]>;

export function pickQuestStats(ctx: BadgeContext): QuestStats {
  const out: Record<string, unknown> = {};
  for (const k of QUEST_KEYS) out[k] = ctx[k];
  return out as QuestStats;
}

/** QuestInstance 以外の BadgeContext 項目（すべて 0 / false の基準値） */
export function nonQuestBaseCtx(): Omit<BadgeContext, (typeof QUEST_KEYS)[number]> {
  return {
    evolutionStage: 1,
    rebirthCount: 0,
    collectionCount: 1,
    hasStudyCollection: false,
    hasStaminaCollection: false,
    hasLifeCollection: false,
    hasAllTypesCollection: false,
    bestTaskStreak: 0,
    loginCurrentStreak: 0,
    loginBestStreak: 0,
    selfTaskCreatedCount: 0,
    selfTaskApprovedCount: 0,
    maxSingleTaskBestStreak: 0,
    unlockedBadgeCount: 0,
    treasureOpenedCount: 0,
    rareTreasureCount: 0,
    collectionItemCount: 0,
    collectionSeasonsComplete: 0,
    hasAllCollectionItems: false,
    rebirthEggUsed: false,
  };
}

// ─── 行ファクトリ ─────────────────────────────────────────────────────────

let seq = 0;

/** 既定: APPROVED / 写真なし / 期限ボーナスなし / JST 12:00 報告 / 作成は2時間前（速報でない） */
export function quest(dateStr: string, over: Partial<QuestRow> = {}): QuestRow {
  const reportedAt = new Date(`${dateStr}T03:00:00Z`); // JST 12:00
  return {
    id: `q${++seq}`,
    childId: "c1",
    date: new Date(`${dateStr}T00:00:00Z`),
    status: "APPROVED",
    photoUrl: null,
    deadlineBonusEarned: false,
    rejectionReason: null,
    reportedAt,
    createdAt: new Date(reportedAt.getTime() - 2 * 60 * 60 * 1000),
    template: { photoBonus: false },
    ...over,
  };
}

export function dateRange(from: string, days: number): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    out.push(d.toISOString().split("T")[0]);
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// ─── 参照実装（集計化前の loadBadgeContext の QuestInstance 処理の写し） ───────

function getISOWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function computeStreakSegments(sortedDates: string[]): { segments: number[]; breaks: number } {
  if (sortedDates.length === 0) return { segments: [], breaks: 0 };
  const deduped = [...new Set(sortedDates)].sort();
  const segments: number[] = [];
  let current = 1;
  let breaks = 0;
  for (let i = 1; i < deduped.length; i++) {
    const prev = new Date(deduped[i - 1] + "T00:00:00Z");
    const curr = new Date(deduped[i] + "T00:00:00Z");
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    if (diffDays === 1) current++;
    else {
      segments.push(current);
      breaks++;
      current = 1;
    }
  }
  segments.push(current);
  return { segments, breaks };
}

export function referenceQuestStats(allQuests: QuestRow[], todayStr: string): QuestStats {
  const JST_OFFSET = 9 * 60 * 60 * 1000;
  const approvedQuests = allQuests.filter((q) => q.status === "APPROVED");
  const skippedQuests = allQuests.filter((q) => q.status === "SKIPPED");

  const approvedCount = approvedQuests.length;
  const photoCount = approvedQuests.filter((q) => q.photoUrl).length;
  const deadlineBonusCount = approvedQuests.filter((q) => q.deadlineBonusEarned).length;
  const skipCount = skippedQuests.length;
  const retrySuccessCount = approvedQuests.filter((q) => q.rejectionReason).length;

  let totalLifetimeXp = 0;
  for (const q of approvedQuests) {
    totalLifetimeXp += 1;
    if (q.deadlineBonusEarned) totalLifetimeXp++;
    if (q.template.photoBonus && q.photoUrl) totalLifetimeXp++;
  }

  const quickReportCount = approvedQuests.filter((q) => {
    if (!q.reportedAt || !q.createdAt) return false;
    return q.reportedAt.getTime() - q.createdAt.getTime() < 30 * 60 * 1000;
  }).length;
  const morningReportCount = approvedQuests.filter((q) => {
    if (!q.reportedAt) return false;
    return new Date(q.reportedAt.getTime() + JST_OFFSET).getUTCHours() < 8;
  }).length;
  const afternoonReportCount = approvedQuests.filter((q) => {
    if (!q.reportedAt) return false;
    const h = new Date(q.reportedAt.getTime() + JST_OFFSET).getUTCHours();
    return h >= 15 && h < 18;
  }).length;

  const ds = (q: QuestRow) => q.date.toISOString().split("T")[0];
  const approvedByDate = new Map<string, QuestRow[]>();
  for (const q of approvedQuests) {
    if (!approvedByDate.has(ds(q))) approvedByDate.set(ds(q), []);
    approvedByDate.get(ds(q))!.push(q);
  }
  const allByDate = new Map<string, QuestRow[]>();
  for (const q of allQuests) {
    if (!allByDate.has(ds(q))) allByDate.set(ds(q), []);
    allByDate.get(ds(q))!.push(q);
  }

  let perfectDaysCount = 0;
  for (const [dateStr, quests] of allByDate) {
    if (dateStr >= todayStr) continue;
    if (quests.length > 0 && quests.every((q) => q.status === "APPROVED" || q.status === "SKIPPED")) {
      perfectDaysCount++;
    }
  }

  const maxQuestsPerDay = Math.max(0, ...[...approvedByDate.values()].map((qs) => qs.length));
  const approvedDates = [...approvedByDate.keys()].sort();

  const skippedDates = new Set(skippedQuests.map(ds));
  const approvedDatesSet = new Set(approvedDates);
  let skipThenNextDayCount = 0;
  for (const dateStr of skippedDates) {
    const next = new Date(dateStr + "T00:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    if (approvedDatesSet.has(next.toISOString().split("T")[0])) skipThenNextDayCount++;
  }

  const byWeek = new Map<string, Set<string>>();
  for (const dateStr of approvedDates) {
    const k = getISOWeekKey(dateStr);
    if (!byWeek.has(k)) byWeek.set(k, new Set());
    byWeek.get(k)!.add(dateStr);
  }
  let weeksWithFivePlusDays = 0;
  let weeksWithSevenDays = 0;
  for (const days of byWeek.values()) {
    if (days.size >= 5) weeksWithFivePlusDays++;
    if (days.size >= 7) weeksWithSevenDays++;
  }

  const byMonth = new Map<string, Set<string>>();
  for (const dateStr of approvedDates) {
    const k = dateStr.slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, new Set());
    byMonth.get(k)!.add(dateStr);
  }
  let monthsWithTenPlusDays = 0;
  let monthsWithFifteenPlusDays = 0;
  let monthsWithTwentyPlusDays = 0;
  let perfectMonthsCount = 0;
  for (const [monthKey, days] of byMonth) {
    const [year, month] = monthKey.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (days.size >= 10) monthsWithTenPlusDays++;
    if (days.size >= 15) monthsWithFifteenPlusDays++;
    if (days.size >= 20) monthsWithTwentyPlusDays++;
    if (days.size >= daysInMonth) perfectMonthsCount++;
  }

  const spring = new Set<string>();
  const summer = new Set<string>();
  const autumn = new Set<string>();
  const winter = new Set<string>();
  let hasNewYearQuest = false;
  let monthEndCount = 0;
  let mondayCount = 0;
  let weekendCount = 0;
  for (const dateStr of approvedDates) {
    const d = new Date(dateStr + "T00:00:00Z");
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const dow = d.getUTCDay();
    const dim = new Date(Date.UTC(d.getUTCFullYear(), month, 0)).getUTCDate();
    if (month === 4) spring.add(dateStr);
    if (month === 7 || month === 8) summer.add(dateStr);
    if (month === 9 || month === 10) autumn.add(dateStr);
    if (month === 12 || month === 1) winter.add(dateStr);
    if (month === 1 && day <= 3) hasNewYearQuest = true;
    if (day >= dim - 2) monthEndCount++;
    if (dow === 1) mondayCount++;
    if (dow === 0 || dow === 6) weekendCount++;
  }

  let hasMagicDay = false;
  let tripleCrownDaysCount = 0;
  for (const quests of approvedByDate.values()) {
    if (quests.some((q) => q.deadlineBonusEarned) && quests.some((q) => q.photoUrl)) {
      hasMagicDay = true;
      tripleCrownDaysCount++;
    }
  }

  const deadlineByWeek = new Map<string, Set<number>>();
  for (const q of approvedQuests.filter((q) => q.deadlineBonusEarned)) {
    const dateStr = ds(q);
    const k = getISOWeekKey(dateStr);
    const dow = new Date(dateStr + "T00:00:00Z").getUTCDay();
    if (!deadlineByWeek.has(k)) deadlineByWeek.set(k, new Set());
    deadlineByWeek.get(k)!.add(dow);
  }
  const hasWeekWithDailyDeadline = [...deadlineByWeek.values()].some((d) => d.size >= 7);

  const { segments, breaks } = computeStreakSegments(approvedDates);
  const postBreakMax = segments.length > 1 ? Math.max(...segments.slice(1)) : 0;

  return {
    totalXp: totalLifetimeXp,
    approvedCount,
    photoCount,
    deadlineBonusCount,
    quickReportCount,
    morningReportCount,
    afternoonReportCount,
    retrySuccessCount,
    skipCount,
    skipThenNextDayCount,
    perfectDaysCount,
    maxQuestsPerDay,
    weeksWithFivePlusDays,
    weeksWithSevenDays,
    monthsWithTenPlusDays,
    monthsWithFifteenPlusDays,
    monthsWithTwentyPlusDays,
    perfectMonthsCount,
    springDays: spring.size,
    summerDays: summer.size,
    autumnDays: autumn.size,
    winterDays: winter.size,
    hasNewYearQuest,
    monthEndCount,
    mondayCount,
    weekendCount,
    hasComeback7: breaks >= 1 && postBreakMax >= 7,
    hasComeback14: breaks >= 1 && postBreakMax >= 14,
    hasComeback7After2Breaks: breaks >= 2 && postBreakMax >= 7,
    hasMagicDay,
    hasWeekWithDailyDeadline,
    tripleCrownDaysCount,
  };
}

// ─── DB 集計の模擬（buildQuestBadgeStats への入力を行から作る） ────────────────

export type PerDateRow = {
  date: string;
  total: number;
  approved: number;
  skipped: number;
  approvedDeadline: number;
  approvedPhoto: number;
};

export type QuestScalars = {
  retrySuccessCount: number;
  photoBonusXpCount: number;
  quickReportCount: number;
  morningReportCount: number;
  afternoonReportCount: number;
};

export function aggregateQuestRows(rows: QuestRow[]): { perDateRows: PerDateRow[]; scalars: QuestScalars } {
  const JST_OFFSET = 9 * 60 * 60 * 1000;
  const map = new Map<string, PerDateRow>();
  for (const q of rows) {
    const date = q.date.toISOString().split("T")[0];
    const r = map.get(date) ?? { date, total: 0, approved: 0, skipped: 0, approvedDeadline: 0, approvedPhoto: 0 };
    r.total++;
    if (q.status === "SKIPPED") r.skipped++;
    if (q.status === "APPROVED") {
      r.approved++;
      if (q.deadlineBonusEarned) r.approvedDeadline++;
      if (q.photoUrl) r.approvedPhoto++;
    }
    map.set(date, r);
  }
  const approved = rows.filter((q) => q.status === "APPROVED");
  const hour = (d: Date) => new Date(d.getTime() + JST_OFFSET).getUTCHours();
  return {
    perDateRows: [...map.values()],
    scalars: {
      retrySuccessCount: approved.filter((q) => q.rejectionReason).length,
      photoBonusXpCount: approved.filter((q) => q.template.photoBonus && q.photoUrl).length,
      quickReportCount: approved.filter(
        (q) => q.reportedAt && q.reportedAt.getTime() - q.createdAt.getTime() < 30 * 60 * 1000,
      ).length,
      morningReportCount: approved.filter((q) => q.reportedAt && hour(q.reportedAt) < 8).length,
      afternoonReportCount: approved.filter(
        (q) => q.reportedAt && hour(q.reportedAt) >= 15 && hour(q.reportedAt) < 18,
      ).length,
    },
  };
}

// ─── 擬似乱数・ランダム行生成 ───────────────────────────────────────────────

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STATUSES = ["APPROVED", "APPROVED", "APPROVED", "SKIPPED", "PENDING", "REPORTED", "REJECTED", "SKIP_REPORTED"];

export function randomQuestRows(seed: number, count: number, from = "2023-01-01", spanDays = 1300): QuestRow[] {
  const rnd = mulberry32(seed);
  const days = dateRange(from, spanDays);
  const rows: QuestRow[] = [];
  for (let i = 0; i < count; i++) {
    // 日付は偏らせる（連続日・欠損日・月末・週またぎを自然に含める）
    const dateStr = days[Math.floor(rnd() * days.length)];
    const status = STATUSES[Math.floor(rnd() * STATUSES.length)];
    const reportedAt =
      rnd() < 0.1 ? null : new Date(`${dateStr}T00:00:00Z`).getTime() + Math.floor(rnd() * 36 * 3600 * 1000) - 6 * 3600 * 1000;
    const createdAt = (reportedAt ?? new Date(`${dateStr}T00:00:00Z`).getTime()) - Math.floor((rnd() * 4 - 0.5) * 3600 * 1000);
    const photoRoll = rnd();
    const reasonRoll = rnd();
    rows.push(
      quest(dateStr, {
        status,
        photoUrl: photoRoll < 0.3 ? "https://x/p.png" : photoRoll < 0.4 ? "" : null,
        deadlineBonusEarned: rnd() < 0.3,
        rejectionReason: reasonRoll < 0.15 ? "やり直し" : reasonRoll < 0.25 ? "" : null,
        reportedAt: reportedAt === null ? null : new Date(reportedAt),
        createdAt: new Date(createdAt),
        template: { photoBonus: rnd() < 0.5 },
      }),
    );
  }
  return rows;
}

// ─── Prisma questInstance の最小インメモリ評価器（SQL の三値論理で where を評価） ──

type Tri = boolean | null;
type AnyObj = Record<string, unknown>;

function valEq(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

function cmp(a: unknown, b: unknown): number {
  const x = a instanceof Date ? a.getTime() : (a as number | string);
  const y = b instanceof Date ? b.getTime() : (b as number | string);
  return x < y ? -1 : x > y ? 1 : 0;
}

function matchField(value: unknown, cond: unknown): Tri {
  if (cond === null) return value === null;
  if (cond instanceof Date || typeof cond !== "object") {
    return value === null ? null : valEq(value, cond);
  }
  const c = cond as AnyObj;
  const results: Tri[] = [];
  for (const [op, arg] of Object.entries(c)) {
    if (op === "equals") results.push(arg === null ? value === null : value === null ? null : valEq(value, arg));
    else if (op === "not") {
      if (arg === null) results.push(value !== null);
      else if (typeof arg === "object" && !(arg instanceof Date)) {
        const inner = matchField(value, arg);
        results.push(inner === null ? null : !inner);
      } else results.push(value === null ? null : !valEq(value, arg));
    } else if (op === "in") results.push(value === null ? null : (arg as unknown[]).some((v) => valEq(value, v)));
    else if (op === "notIn") results.push(value === null ? null : !(arg as unknown[]).some((v) => valEq(value, v)));
    else if (op === "gt") results.push(value === null ? null : cmp(value, arg) > 0);
    else if (op === "gte") results.push(value === null ? null : cmp(value, arg) >= 0);
    else if (op === "lt") results.push(value === null ? null : cmp(value, arg) < 0);
    else if (op === "lte") results.push(value === null ? null : cmp(value, arg) <= 0);
    else throw new Error(`in-memory evaluator: unsupported operator ${op}`);
  }
  return and(results);
}

function and(rs: Tri[]): Tri {
  if (rs.some((r) => r === false)) return false;
  if (rs.some((r) => r === null)) return null;
  return true;
}
function or(rs: Tri[]): Tri {
  if (rs.some((r) => r === true)) return true;
  if (rs.some((r) => r === null)) return null;
  return false;
}
const not = (r: Tri): Tri => (r === null ? null : !r);
const asArray = (v: unknown): AnyObj[] => (Array.isArray(v) ? (v as AnyObj[]) : [v as AnyObj]);

function evalWhere(row: AnyObj, where: AnyObj | undefined): Tri {
  if (!where) return true;
  const parts: Tri[] = [];
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (key === "AND") parts.push(and(asArray(cond).map((w) => evalWhere(row, w))));
    else if (key === "OR") parts.push(or(asArray(cond).map((w) => evalWhere(row, w))));
    else if (key === "NOT") parts.push(and(asArray(cond).map((w) => not(evalWhere(row, w)))));
    else if (key === "template") {
      const rel = ((cond as AnyObj).is ?? cond) as AnyObj;
      parts.push(evalWhere(row.template as AnyObj, rel));
    } else parts.push(matchField(row[key], cond));
  }
  return and(parts);
}

const filterRows = (rows: QuestRow[], where?: AnyObj) =>
  rows.filter((r) => evalWhere(r as unknown as AnyObj, where) === true);

function countSpec(spec: unknown, rows: QuestRow[]): unknown {
  if (spec === true) return rows.length;
  const out: AnyObj = {};
  for (const [k, on] of Object.entries((spec ?? {}) as AnyObj)) {
    if (!on) continue;
    out[k] = k === "_all" ? rows.length : rows.filter((r) => (r as unknown as AnyObj)[k] !== null).length;
  }
  return out;
}

/** prismaMock.questInstance の findMany / count / groupBy を rows に対する評価器へ差し替える */
export function wireQuestInstanceDb(
  prismaMockQuest: { findMany: unknown; count: unknown; groupBy: unknown },
  rows: QuestRow[],
): void {
  type Mockable = { mockImplementation: (fn: (args?: AnyObj) => Promise<unknown>) => void };
  (prismaMockQuest.findMany as Mockable).mockImplementation(async (args = {}) => {
    const found = filterRows(rows, args.where as AnyObj);
    const select = args.select as AnyObj | undefined;
    if (!select) return found;
    return found.map((r) => {
      const o: AnyObj = {};
      for (const [k, on] of Object.entries(select)) if (on) o[k] = (r as unknown as AnyObj)[k];
      return o;
    });
  });
  (prismaMockQuest.count as Mockable).mockImplementation(async (args = {}) => filterRows(rows, args.where as AnyObj).length);
  (prismaMockQuest.groupBy as Mockable).mockImplementation(async (args = {}) => {
    const by = args.by as string[];
    const groups = new Map<string, QuestRow[]>();
    for (const r of filterRows(rows, args.where as AnyObj)) {
      const key = by
        .map((f) => {
          const v = (r as unknown as AnyObj)[f];
          return v instanceof Date ? `d${v.getTime()}` : JSON.stringify(v);
        })
        .join("|");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return [...groups.values()].map((g) => {
      const o: AnyObj = {};
      for (const f of by) o[f] = (g[0] as unknown as AnyObj)[f];
      if (args._count !== undefined) o._count = countSpec(args._count, g);
      return o;
    });
  });
}
