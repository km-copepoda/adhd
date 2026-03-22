/** 報告時刻を相対時間で表示（クライアント用）*/
export function formatReportedTime(iso: string, now?: Date): string {
  const d = new Date(iso);
  const ref = now ?? new Date();
  const diffMs = ref.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}時間前`;
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}



const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function jstNow(): Date {
  return new Date(Date.now() + JST_OFFSET_MS);
}

/** 今日の日付を JST で取得（@db.Date用、UTC 0字に正規化） */
export function todayJST(): Date {
  const jst = jstNow();
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()));
}

/** JST での今日の曜日（0=Sun ... 6=Sat）*/
export function dayOfWeekJST(): number {
  return jstNow().getUTCDay();
}

/** JST での今月の開始日（@db.Date用）*/
export function monthStartJST(): Date {
  const jst = jstNow();
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1));
}

/** JST での今月の終了日（@db.Date用）*/
export function monthEndJST(): Date {
  const jst = jstNow();
  return new Date(Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth() + 1, 0));
}

/** JST での今日の開始～翌日開始を UTC で返す（DateTime フィルタ用）*/
export function todayRangeJST(): { start: Date; end: Date } {
  const today = todayJST();
  const start = new Date(today.getTime() - JST_OFFSET_MS);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/** JST の今日を "YYYY-MM-DD" 文字列で返す（クライアント/サーバ共用）*/
export function todayStringJST(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

/** 期限切れでない表示可能な一時タスクかどうか */
export function isVisibleTemporaryTask(
  task: { isTemporary: boolean; createdBy: string; completedToday: boolean; targetDate: string | null },
  todayStr: string,
): boolean {
  if (!task.isTemporary || task.createdBy === "CHILD" || task.completedToday) return false;
  if (task.targetDate && task.targetDate.slice(0, 10) < todayStr) return false;
  return true;
}