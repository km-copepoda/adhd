import { createClient } from "@/lib/supabase/client";
import { fetchDeduped } from "@/lib/fetchDeduped";
import { familyRealtimeFilter, type FamilyRealtimeTable } from "@/lib/realtimeFilters";

// 親画面の Realtime（postgres_changes）購読を、自分の家族の子供の行に絞って開く（クライアント専用）。
// QuestInstance / TreasureLog には家族の列がないため、/api/family/code の子供一覧で childId を絞る。

/** 家族の子供 ID 一覧。取得失敗なら null。 */
async function fetchFamilyChildIds(): Promise<string[] | null> {
  try {
    const res = await fetchDeduped("/api/family/code");
    if (!res.ok) return null;
    const data = (await res.json()) as { members?: { id: string; role: string }[] };
    return (data.members ?? []).filter((m) => m.role === "CHILD").map((m) => m.id);
  } catch {
    return null;
  }
}

/**
 * 指定テーブルの変更を購読し、変更があれば onChange を呼ぶ。戻り値の関数で解除する。
 * 子供一覧の取得に失敗した場合はフィルタなしで購読し（従来どおり）、子供がいなければ購読しない。
 */
export function subscribeFamilyRealtime(
  name: string,
  tables: FamilyRealtimeTable[],
  onChange: () => void,
): () => void {
  let cancelled = false;
  let removeChannel: (() => void) | null = null;

  void fetchFamilyChildIds().then((childIds) => {
    if (cancelled) return;
    const subscriptions = tables
      .map((table) => ({ table, filter: familyRealtimeFilter(table, childIds) }))
      .filter((s) => s.filter !== null);
    if (subscriptions.length === 0) return;

    const supabase = createClient();
    let channel = supabase.channel(name);
    for (const { table, filter } of subscriptions) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        onChange,
      );
    }
    channel.subscribe();
    removeChannel = () => {
      supabase.removeChannel(channel);
    };
  });

  return () => {
    cancelled = true;
    removeChannel?.();
    removeChannel = null;
  };
}
