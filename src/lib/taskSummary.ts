import { prisma } from "@/lib/prisma";
import { todayJST, countScheduledOccurrences, jstDateOf } from "@/lib/date";
import { ensureTodayQuests } from "@/lib/quests";

type QuestRow = { templateId: string; date: Date | null };

/** JSON カラムから復元される停止期間。start / end とも JST 日付相当の Date（UTC 0時表現に正規化して扱う）*/
export type PauseInterval = { start: Date; end: Date };

const MS_PER_DAY = 86_400_000;

/**
 * 生の pauseIntervals JSON 値 (`{ start: ISO, end: ISO }[]`) を Date 化する。
 * 予期しない形状は無視して空配列にフォールバック（過去データ・手動編集への防御）。
 */
export function parsePauseIntervals(raw: unknown): PauseInterval[] {
  if (!Array.isArray(raw)) return [];
  const out: PauseInterval[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const start = (item as { start?: unknown }).start;
    const end = (item as { end?: unknown }).end;
    if (typeof start !== "string" || typeof end !== "string") continue;
    const s = new Date(start);
    const e = new Date(end);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) continue;
    out.push({ start: s, end: e });
  }
  return out;
}

/**
 * [rangeStart, rangeEnd] inclusive に含まれる停止期間の暦日数（重複区間が無い前提の単純合算）。
 * 各 interval も JST 日付単位に正規化してから overlap を計算する。
 */
export function totalPausedDaysInRange(
  rangeStart: Date,
  rangeEnd: Date,
  intervals: PauseInterval[],
): number {
  const rs = jstDateOf(rangeStart).getTime();
  const re = jstDateOf(rangeEnd).getTime();
  if (rs > re) return 0;
  let total = 0;
  for (const iv of intervals) {
    const is = jstDateOf(iv.start).getTime();
    const ie = jstDateOf(iv.end).getTime();
    const lo = Math.max(rs, is);
    const hi = Math.min(re, ie);
    if (hi >= lo) total += Math.round((hi - lo) / MS_PER_DAY) + 1;
  }
  return total;
}

/**
 * 過去の停止期間に「現在停止中なら [pausedAt, today]」を追加した effective interval 一覧を返す。
 * これを `calcCarryOverMissedCount` や `activeDaysBetween` に渡すことで、
 * 「停止中は today の分もカウントから除外 = 実質的に凍結」を単一パスで表現できる。
 *
 * 実今日 (`today`) を各計算で使い続けるため、「effective today シフト + interval 除外」の
 * 二重減算に陥らないのがポイント。
 */
export function effectiveIntervalsFor(
  pauseIntervals: PauseInterval[],
  pausedAt: Date | null,
  today: Date,
): PauseInterval[] {
  if (!pausedAt) return pauseIntervals;
  return [...pauseIntervals, { start: pausedAt, end: today }];
}

/**
 * `[from, to]` の JST 日数差から停止期間の overlap ぶんを差し引いた「active な経過日数」。
 * 「N日前スキップ」バッジで停止期間中は日数がカウントアップしないようにするために使う。
 * from == to は 0、from > to は 0 で返す (未来スキップの防御)。
 */
export function activeDaysBetween(
  from: Date,
  to: Date,
  intervals: PauseInterval[],
): number {
  const fromMs = jstDateOf(from).getTime();
  const toMs = jstDateOf(to).getTime();
  if (toMs <= fromMs) return 0;
  const diffDays = Math.round((toMs - fromMs) / MS_PER_DAY);
  const paused = totalPausedDaysInRange(from, to, intervals);
  return Math.max(0, diffDays - paused);
}

/**
 * carryOver タスクの「過去から持ち越し中の最古 PENDING 日付」を計算する。
 *
 * 直近の APPROVED/SKIPPED より古い PENDING は stale として無視する
 * （carryOver を後から ON にした等で、完了済みより古い PENDING が DB に残っているケース）。
 *
 * 入力前提:
 *   - `carryOverPending` は date 昇順
 *   - `settled` は date 降順
 */
export function computeOldestPendingDates(
  carryOverPending: QuestRow[],
  settled: QuestRow[],
): Map<string, Date> {
  const latestSettledMap = new Map<string, Date>();
  for (const q of settled) {
    if (!latestSettledMap.has(q.templateId) && q.date) {
      latestSettledMap.set(q.templateId, q.date);
    }
  }
  const oldestPendingMap = new Map<string, Date>();
  for (const q of carryOverPending) {
    if (!q.date) continue;
    const s = latestSettledMap.get(q.templateId);
    if (s && q.date <= s) continue;
    if (!oldestPendingMap.has(q.templateId)) {
      oldestPendingMap.set(q.templateId, q.date);
    }
  }
  return oldestPendingMap;
}

/**
 * 親画面タスクカードの「⏭ N日前スキップ」バッジ表示用に、
 * 「以降に APPROVED が無い」最新の SKIPPED 日付を templateId 別に返す。
 *
 * SKIPPED より後に APPROVED が記録された template はバッジを出さない
 * （その後ちゃんと完了しているので、スキップ事実だけが残り続けるのを防ぐ）。
 *
 * 入力前提:
 *   - `skipped` / `approved` は date 降順（先頭が最新）
 *   - 複数 children が同じ template を共有する場合も templateId 単位で集約する
 */
export function computeLastSkippedDates(
  skipped: QuestRow[],
  approved: QuestRow[],
): Map<string, Date> {
  const latestApprovedMap = new Map<string, Date>();
  for (const q of approved) {
    if (!q.date) continue;
    if (!latestApprovedMap.has(q.templateId)) {
      latestApprovedMap.set(q.templateId, q.date);
    }
  }
  const out = new Map<string, Date>();
  for (const q of skipped) {
    if (!q.date) continue;
    if (out.has(q.templateId)) continue;
    const approvedAt = latestApprovedMap.get(q.templateId);
    // approvedAt > skippedAt なら「その後完了済み」とみなしてバッジを消す。
    // 同日 (==) は DB unique 制約で起きないが、起きた場合は防御的にバッジを残す。
    if (approvedAt && approvedAt > q.date) continue;
    out.set(q.templateId, q.date);
  }
  return out;
}

/**
 * 指定日 (JST 日付) が pauseIntervals のいずれかの区間に含まれるか。
 * インターバル境界日 (start / end) は inclusive 扱い。
 */
function isDayInPauseIntervals(day: Date, intervals: PauseInterval[]): boolean {
  const t = jstDateOf(day).getTime();
  for (const iv of intervals) {
    const s = jstDateOf(iv.start).getTime();
    const e = jstDateOf(iv.end).getTime();
    if (t >= s && t <= e) return true;
  }
  return false;
}

/**
 * carryOver タスクの「N回未完了」を計算する。
 *
 * - 通常タスク: 最古 PENDING の日付から today までの inclusive 範囲で、repeatDays に当たる出現回数
 * - 一時タスク (repeatDays が空): 出現は 1 度のみ定義だが、carryOver で持ち越しているため
 *   「持ち越し何日目か」(oldestPendingDate から today までの暦日 inclusive) を返す。
 *   親バッジで「何日放置されたか」の視覚シグナルを得るための挙動。
 *
 * `pauseIntervals` が渡されると、範囲 [oldestPendingDate, today] のうち停止期間中の日を除外する
 * （停止中に発生した予定日はカウントしない）。停止中の凍結は呼び出し側が `today` に
 * `computeEffectiveTodayForPausedTemplate` を渡すことで実現する。
 */
export function calcCarryOverMissedCount(
  oldestPendingDate: Date | null | undefined,
  today: Date,
  repeatDays: number[],
  pauseIntervals: PauseInterval[] = [],
): number | null {
  if (!oldestPendingDate) return null;
  if (jstDateOf(today).getTime() < jstDateOf(oldestPendingDate).getTime()) {
    return repeatDays.length === 0 ? 1 : 0;
  }
  if (repeatDays.length === 0) {
    const diffDays = Math.floor(
      (jstDateOf(today).getTime() - jstDateOf(oldestPendingDate).getTime()) / MS_PER_DAY,
    );
    const inclusiveDays = diffDays + 1;
    const paused = totalPausedDaysInRange(oldestPendingDate, today, pauseIntervals);
    return Math.max(1, inclusiveDays - paused);
  }
  if (pauseIntervals.length === 0) {
    return countScheduledOccurrences(oldestPendingDate, today, repeatDays);
  }
  // 停止期間中に当たる予定日 (repeatDays マッチ) を除外して数える
  const fromMs = jstDateOf(oldestPendingDate).getTime();
  const toMs = jstDateOf(today).getTime();
  const days = Math.round((toMs - fromMs) / MS_PER_DAY) + 1;
  let count = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(fromMs + i * MS_PER_DAY);
    if (!repeatDays.includes(d.getUTCDay())) continue;
    if (isDayInPauseIntervals(d, pauseIntervals)) continue;
    count++;
  }
  return count;
}

/**
 * 親画面用のタスク一覧サマリーを構築する。
 *
 * - 子供画面が一度も開かれていなくても今日分のクエストを materialize（carryOver の動作保証のため）
 * - 各タスクに当日の完了状態、直近7日間の最終 SKIPPED 日、carryOver 累積回数を付与する
 */
export async function getParentTaskSummaries(familyId: string) {
  const children = await prisma.user.findMany({
    where: { familyId, role: "CHILD" },
    select: { id: true },
  });
  await Promise.all(
    children.map((c) => ensureTodayQuests({ childId: c.id, familyId })),
  );

  const tasks = await prisma.taskTemplate.findMany({
    where: { familyId, isActive: true },
    include: {
      assignedChild: { select: { id: true, monsterName: true } },
      taskStreaks: {
        select: { childId: true, currentStreak: true, bestStreak: true, lastAchievedDate: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const today = todayJST();
  const taskIds = tasks.map((t) => t.id);

  const completedQuests = await prisma.questInstance.findMany({
    where: {
      templateId: { in: taskIds },
      date: today,
      status: { in: ["APPROVED", "SKIPPED"] },
    },
    select: { templateId: true },
  });
  const completedSet = new Set(completedQuests.map((q) => q.templateId));

  // 各テンプレートの effective 停止区間（過去 pauseIntervals + 現在停止中なら [pausedAt, today]）を
  // 事前計算しておき、SQL 窓の拡張とバッジ計算で使い回す。
  const perTemplateIntervals = new Map<string, PauseInterval[]>();
  let maxTotalPauseSpanDays = 0;
  for (const t of tasks) {
    const past = parsePauseIntervals((t as { pauseIntervals?: unknown }).pauseIntervals);
    const pausedAt = (t as { pausedAt?: Date | null }).pausedAt ?? null;
    const eff = effectiveIntervalsFor(past, pausedAt, today);
    perTemplateIntervals.set(t.id, eff);
    const span = eff.reduce((sum, iv) => {
      const s = jstDateOf(iv.start).getTime();
      const e = jstDateOf(iv.end).getTime();
      return sum + Math.max(0, Math.round((e - s) / MS_PER_DAY) + 1);
    }, 0);
    if (span > maxTotalPauseSpanDays) maxTotalPauseSpanDays = span;
  }

  // 直近「7 active days」相当を取得する。停止 8 日超のテンプレートでも停止直前スキップを
  // 取りこぼさないよう、SQL 窓は `today - 7 - maxTotalPauseSpanDays` まで広げる。
  // active days の絞り込みは per-template で JS 側 (activeDaysBetween) が最終判定する。
  const skipWindowStart = new Date(today);
  skipWindowStart.setUTCDate(skipWindowStart.getUTCDate() - 7 - maxTotalPauseSpanDays);
  const recentSkipped = await prisma.questInstance.findMany({
    where: {
      templateId: { in: taskIds },
      status: "SKIPPED",
      date: { gte: skipWindowStart, lte: today },
    },
    select: { templateId: true, date: true },
    orderBy: { date: "desc" },
  });
  // SKIPPED の最古日付以降に APPROVED があるかだけ確認できればよいので、同じ窓で取得する。
  const recentApproved = await prisma.questInstance.findMany({
    where: {
      templateId: { in: taskIds },
      status: "APPROVED",
      date: { gte: skipWindowStart, lte: today },
    },
    select: { templateId: true, date: true },
    orderBy: { date: "desc" },
  });
  const lastSkippedMap = computeLastSkippedDates(recentSkipped, recentApproved);

  const carryOverTaskIds = tasks
    .filter((t) => (t as { carryOver?: boolean }).carryOver)
    .map((t) => t.id);
  let oldestPendingMap = new Map<string, Date>();
  if (carryOverTaskIds.length > 0) {
    const carryOverPending = await prisma.questInstance.findMany({
      where: {
        templateId: { in: carryOverTaskIds },
        status: "PENDING",
        date: { lt: today },
      },
      select: { templateId: true, date: true },
      orderBy: { date: "asc" },
    });
    const latestSettled = await prisma.questInstance.findMany({
      where: {
        templateId: { in: carryOverTaskIds },
        status: { in: ["APPROVED", "SKIPPED"] },
      },
      select: { templateId: true, date: true },
      orderBy: { date: "desc" },
    });
    oldestPendingMap = computeOldestPendingDates(carryOverPending, latestSettled);
  }

  return tasks.map((t) => {
    const oldest = oldestPendingMap.get(t.id);
    const repeatDays = (t as { repeatDays?: number[] }).repeatDays ?? [];
    const activeIntervals = perTemplateIntervals.get(t.id) ?? [];
    // スキップバッジ: active 経過日数 (activeDaysBetween) が 7 以下なら表示する。
    // 表示側で `daysSinceJST` を再計算しないよう、`lastSkippedActiveDaysAgo` を server 側で算出して返す。
    // rawSkip 生日付は tooltip 用に別途返す。
    const rawSkip = lastSkippedMap.get(t.id) ?? null;
    let lastSkippedDate: Date | null = null;
    let lastSkippedActiveDaysAgo: number | null = null;
    if (rawSkip) {
      const ago = activeDaysBetween(rawSkip, today, activeIntervals);
      if (ago <= 7) {
        lastSkippedDate = rawSkip;
        lastSkippedActiveDaysAgo = ago;
      }
    }
    return {
      ...t,
      completedToday: completedSet.has(t.id),
      lastSkippedDate,
      lastSkippedActiveDaysAgo,
      carryOverMissedCount: calcCarryOverMissedCount(
        oldest,
        today,
        repeatDays,
        activeIntervals,
      ),
    };
  });
}
