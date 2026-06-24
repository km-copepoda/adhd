import { isBeforeCheckinDeadline } from "@/lib/checkin.logic";

export type CellState = "success" | "fail" | "today" | "future" | "empty";

export interface CalendarCell {
  /** "YYYY-MM-DD"。月外は前月/翌月の日付 */
  date: string;
  /** 1〜31。月外も含む */
  day: number;
  /** その月の日かどうか */
  inMonth: boolean;
  state: CellState;
}

export interface BuildGridInput {
  year: number;
  month: number; // 1..12
  logs: { date: string; success: boolean }[];
  todayStr: string; // "YYYY-MM-DD" (JST)
  deadline: string; // "HH:MM"
  now: Date;
  /** "YYYY-MM-DD"。これより前の月内日は empty（機能ON以前） */
  enabledSince?: string;
}

/** 月曜始まりの週グリッドを返す（6週 × 7日） */
export function buildCalendarGrid(input: BuildGridInput): CalendarCell[][] {
  const { year, month, logs, todayStr, deadline, now, enabledSince } = input;
  const logMap = new Map(logs.map((l) => [l.date, l.success]));

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = monthStart.getUTCDay(); // 0=Sun..6=Sat
  // 月曜始まり: Mon=0, Tue=1, ..., Sun=6
  const offset = (startWeekday + 6) % 7;
  const gridStart = new Date(monthStart.getTime() - offset * 86400000);

  const weeks: CalendarCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(gridStart.getTime() + (w * 7 + d) * 86400000);
      const dateStr = formatYmd(cellDate);
      const day = cellDate.getUTCDate();
      const inMonth =
        cellDate.getUTCFullYear() === year && cellDate.getUTCMonth() === month - 1;
      week.push({
        date: dateStr,
        day,
        inMonth,
        state: classify(dateStr, inMonth, logMap, todayStr, deadline, now, enabledSince),
      });
    }
    weeks.push(week);
  }
  // 末尾の全 empty 行を削る（最終週が前月でない＆全 empty なら 5週で終わるよう）
  while (weeks.length > 1 && weeks[weeks.length - 1].every((c) => !c.inMonth)) {
    weeks.pop();
  }
  return weeks;
}

function classify(
  dateStr: string,
  inMonth: boolean,
  logMap: Map<string, boolean>,
  todayStr: string,
  deadline: string,
  now: Date,
  enabledSince?: string,
): CellState {
  if (!inMonth) return "empty";
  if (enabledSince && dateStr < enabledSince) return "empty";
  const log = logMap.get(dateStr);
  if (log === true) return "success";
  if (log === false) return "fail";
  // ログなし
  if (dateStr > todayStr) return "future";
  if (dateStr < todayStr) return "fail";
  // 今日
  const questDate = new Date(dateStr + "T00:00:00Z");
  return isBeforeCheckinDeadline(now, questDate, deadline) ? "today" : "fail";
}

function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
