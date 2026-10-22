import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { fetchDeduped, invalidateDeduped } from "@/lib/fetchDeduped";
import { childRealtimeFilter, type ChildRealtimeTable } from "@/lib/realtimeFilters";

// 子供画面の Realtime（postgres_changes）購読を、アプリ全体で1チャンネルに共有する（クライアント専用）。
//
// 以前は BottomNav / MonsterCutsceneListener / useChildQuests / BadgeUnlockToast などが
// それぞれ別チャンネルで購読していたため、クエスト画面を開くだけで購読が7本になっていた。
// Supabase Realtime は変更1件ごとに購読ぶんの内部クエリを走らせるので、DB 負荷（特に Nano）に響く。
// ここでは4テーブルを1チャンネルで購読し、アプリ内のリスナーへ振り分ける。
// リスナーが0になったらチャンネルを破棄し、また誰かが購読したら作り直す。
//
// さらに購読を自分の行だけに絞る（フィルタなしだと全家庭の変更ごとに RLS 評価と再取得が走る）。
// 自分の ID は /api/users/me で取得し、分かるまではフィルタなしで購読して、分かった時点で張り替える。
// 取得に失敗した場合はフィルタなしのまま購読を続ける。

export type { ChildRealtimeTable };
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
// 自分（子供）の User.id。取得できたらモジュール内で保持し、以降のチャンネルは最初からフィルタ付きで開く
let userId: string | null = null;
let resolvingUserId = false;

function listenerCount(): number {
  return Object.values(listeners).reduce((n, set) => n + set.size, 0);
}

function dispatch(table: ChildRealtimeTable, payload: ChildRealtimePayload) {
  // 変更イベントを受けた再取得が、イベント前に始まった進行中の GET に相乗りして古い値を拾わないようにする。
  // イベントごとに1回だけ無効化するので、同じイベントを受けた複数リスナーは新しい1本の fetch を共有できる。
  invalidateDeduped();
  for (const entry of [...listeners[table]]) {
    try {
      entry.handler(payload);
    } catch (e) {
      // 1つのリスナーの失敗で他のリスナーへの配信を止めない
      console.error(`[childRealtime] ${table} listener failed`, e);
    }
  }
}

function on(table: ChildRealtimeTable, event: "*" | "INSERT" | "UPDATE") {
  const filter = childRealtimeFilter(table, userId);
  return { event, schema: "public", table, ...(filter ? { filter } : {}) } as const;
}

function open() {
  const supabase = createClient();
  const channel = supabase
    .channel(`child-realtime-${++channelSeq}`)
    .on("postgres_changes", on("User", "UPDATE"), (p) => dispatch("User", p))
    .on("postgres_changes", on("UserBadge", "INSERT"), (p) => dispatch("UserBadge", p))
    .on("postgres_changes", on("QuestInstance", "*"), (p) => dispatch("QuestInstance", p))
    .on("postgres_changes", on("TreasureLog", "*"), (p) => dispatch("TreasureLog", p))
    .subscribe();
  active = { removeChannel: () => supabase.removeChannel(channel) };
}

/** 自分の ID を取得し、フィルタなしで開いているチャンネルをフィルタ付きに張り替える */
function resolveUserId() {
  if (userId || resolvingUserId) return;
  resolvingUserId = true;
  fetchDeduped("/api/users/me")
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { id?: unknown } | null) => {
      if (typeof data?.id !== "string") return;
      userId = data.id;
      if (active) {
        close();
        open();
      }
    })
    .catch(() => {
      // 取得失敗時はフィルタなしのまま購読を続ける
    })
    .finally(() => {
      resolvingUserId = false;
    });
}

function close() {
  active?.removeChannel();
  active = null;
}

/** 指定テーブルの変更を購読する。戻り値の関数で解除する（二重に呼んでも安全）。 */
export function subscribeChildRealtime(table: ChildRealtimeTable, handler: Handler): () => void {
  const entry: Entry = { handler };
  listeners[table].add(entry);
  if (!active) {
    open();
    resolveUserId();
  }

  return () => {
    if (!listeners[table].delete(entry)) return;
    if (listenerCount() === 0) close();
  };
}
