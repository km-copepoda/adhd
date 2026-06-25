import { isBeforeCheckinDeadline } from "@/lib/checkin.logic";

export type CellState = "success" | "fail" | "today" | "future" | "empty";

export interface CalendarCell {
  /** "YYYY-MM-DD" */
  date: string;
  /** 1〜31 */
  day: number;
  /** 曜日 JS Date.getUTCDay() 準拠 (日=0..土=6) */
  weekday: number;
  state: CellState;
}

export interface BuildStripInput {
  /** 末尾（右端）の日付 "YYYY-MM-DD"（通常は今日 JST） */
  todayStr: string;
  /** ストリップに並べる日数（デフォルト 7） */
  days?: number;
  logs: { date: string; success: boolean }[];
  /** "HH:MM" */
  deadline: string;
  now: Date;
  /** "YYYY-MM-DD"。これより前の日はログなしでも empty（機能が有効になる前は表示しない） */
  enabledSince?: string;
}

/**
 * 直近 N 日（既定 7 日）のチェックインストリップを返す。
 * 左端が最古、右端が今日。
 */
export function buildWeekStrip(input: BuildStripInput): CalendarCell[] {
  const { todayStr, logs, deadline, now, enabledSince } = input;
  const days = input.days ?? 7;
  const logMap = new Map(logs.map((l) => [l.date, l.success]));

  const todayUTC = parseDateUTC(todayStr);
  const cells: CalendarCell[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(todayUTC.getTime() - i * 86400000);
    const dateStr = formatYmd(d);
    cells.push({
      date: dateStr,
      day: d.getUTCDate(),
      weekday: d.getUTCDay(), // 日=0..土=6
      state: classify(dateStr, logMap, todayStr, deadline, now, enabledSince),
    });
  }
  return cells;
}

function classify(
  dateStr: string,
  logMap: Map<string, boolean>,
  todayStr: string,
  deadline: string,
  now: Date,
  enabledSince?: string,
): CellState {
  if (enabledSince && dateStr < enabledSince) return "empty";
  const log = logMap.get(dateStr);
  if (log === true) return "success";
  if (log === false) return "fail";
  if (dateStr > todayStr) return "future";
  if (dateStr < todayStr) return "fail";
  // 今日
  const questDate = parseDateUTC(dateStr);
  return isBeforeCheckinDeadline(now, questDate, deadline) ? "today" : "fail";
}

export interface BuildMonthInput {
  year: number;
  month: number; // 1..12
  logs: { date: string; success: boolean }[];
  /** "YYYY-MM-DD" 今日 JST */
  todayStr: string;
  deadline: string;
  now: Date;
  /** "YYYY-MM-DD" これより前の日はログ無しでも empty */
  enabledSince?: string;
}

/**
 * 月内の各日（1〜末日）について CalendarCell を返す。
 * 週並びへの先頭オフセットは描画側で `cells[0].weekday` を使って計算する。
 * weekday は 日=0..土=6（HeatmapGrid に合わせる）。
 */
export function buildMonthGrid(input: BuildMonthInput): CalendarCell[] {
  const { year, month, logs, todayStr, deadline, now, enabledSince } = input;
  const logMap = new Map(logs.map((l) => [l.date, l.success]));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: CalendarCell[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(year, month - 1, d));
    const dateStr = formatYmd(date);
    cells.push({
      date: dateStr,
      day: d,
      weekday: date.getUTCDay(), // 日=0..土=6
      state: classify(dateStr, logMap, todayStr, deadline, now, enabledSince),
    });
  }
  return cells;
}

function parseDateUTC(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
