import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// 子供画面の Realtime（postgres_changes）購読を、アプリ全体で1チャンネルに共有する（クライアント専用）。
//
// 以前は BottomNav / MonsterCutsceneListener / useChildQuests / BadgeUnlockToast などが
// それぞれ別チャンネルで購読していたため、クエスト画面を開くだけで購読が7本になっていた。
// Supabase Realtime は変更1件ごとに購読ぶんの内部クエリを走らせるので、DB 負荷（特に Nano）に響く。
// ここでは4テーブルを1チャンネルで購読し、アプリ内のリスナーへ振り分ける。
// リスナーが0になったらチャンネルを破棄し、また誰かが購読したら作り直す。

export type ChildRealtimeTable = "User" | "UserBadge" | "QuestInstance" | "TreasureLog";
export type ChildRealtimePayload = RealtimePostgresChangesPayload<Record<string, unknown>>;
type Handler = (payload: ChildRealtimePayload) => void;

// 解除を「登録ごとに独立」させるため、関数そのものではなくエントリ（オブジェクト）で管理する
type Entry = { handler: Handler };

const listeners: Record<ChildRealtimeTable, Set<Entry>> = {
  User: new Set(),
  UserBadge: new Set(),
  QuestInstance: new Set(),
  TreasureLog: new Set(),
};

let active: { removeChannel: () => void } | null = null;
// removeChannel は非同期のため、全解除→即再購読（StrictMode の二重マウント等）で同名トピックが衝突しないよう連番を付ける
let channelSeq = 0;

function listenerCount(): number {
  return Object.values(listeners).reduce((n, set) => n + set.size, 0);
}

function dispatch(table: ChildRealtimeTable, payload: ChildRealtimePayload) {
  for (const entry of [...listeners[table]]) {
    try {
      entry.handler(payload);
    } catch (e) {
      // 1つのリスナーの失敗で他のリスナーへの配信を止めない
      console.error(`[childRealtime] ${table} listener failed`, e);
    }
  }
}

function open() {
  const supabase = createClient();
  const channel = supabase
    .channel(`child-realtime-${++channelSeq}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "User" }, (p) =>
      dispatch("User", p),
    )
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "UserBadge" }, (p) =>
      dispatch("UserBadge", p),
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "QuestInstance" }, (p) =>
      dispatch("QuestInstance", p),
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "TreasureLog" }, (p) =>
      dispatch("TreasureLog", p),
    )
    .subscribe();
  active = { removeChannel: () => supabase.removeChannel(channel) };
}

function close() {
  active?.removeChannel();
  active = null;
}

/** 指定テーブルの変更を購読する。戻り値の関数で解除する（二重に呼んでも安全）。 */
export function subscribeChildRealtime(table: ChildRealtimeTable, handler: Handler): () => void {
  const entry: Entry = { handler };
  listeners[table].add(entry);
  if (!active) open();

  return () => {
    if (!listeners[table].delete(entry)) return;
    if (listenerCount() === 0) close();
  };
}
