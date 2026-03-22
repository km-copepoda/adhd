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