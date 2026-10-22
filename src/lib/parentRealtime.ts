import { createClient } from "@/lib/supabase/client";
import { fetchDeduped, invalidateDeduped } from "@/lib/fetchDeduped";
import { familyRealtimeFilter, type FamilyRealtimeTable } from "@/lib/realtimeFilters";

// 親画面の Realtime（postgres_changes）購読を、自分の家族の子供の行に絞って開く（クライアント専用）。
// QuestInstance / TreasureLog には家族の列がないため、/api/family/code の子供一覧で childId を絞る。
// 子供の追加・削除後は notifyFamilyMembersChanged() で、開いている購読を新しい子供一覧で張り直す。

const FAMILY_CODE_URL = "/api/family/code";

// 家族構成の変化を購読中の各 subscribeFamilyRealtime に伝えるためのリスナー
const familyChangeListeners = new Set<() => void>();

/** 子供の追加・削除後に呼ぶ。開いている購読を新しい子供一覧で張り直す。 */
export function notifyFamilyMembersChanged(): void {
  invalidateDeduped(FAMILY_CODE_URL);
  for (const listener of [...familyChangeListeners]) listener();
}

/** 家族の子供 ID 一覧。取得失敗なら null。 */
async function fetchFamilyChildIds(): Promise<string[] | null> {
  try {
    const res = await fetchDeduped(FAMILY_CODE_URL);
    if (!res.ok) return null;
    const data = (await res.json()) as { members?: { id: string; role: string }[] };
    return (data.members ?? []).filter((m) => m.role === "CHILD").map((m) => m.id);
  } catch {
    return null;
  }
}

/**
 * 指定テーブルの変更を購読し、変更があれば onChange を呼ぶ。戻り値の関数で解除する。
 * 子供一覧の取得に失敗した場合はフィルタなしで購読し（従来どおり）、子供がいなければ購読しない
 * （フィルタなしの購読は全家庭の変更ごとに RLS 評価が走るため。子供を追加すれば張り直しで購読が始まる）。
 */
export function subscribeFamilyRealtime(
  name: string,
  tables: FamilyRealtimeTable[],
  onChange: () => void,
): () => void {
  let cancelled = false;
  // 張り直しが重なったとき、古い取得結果でチャンネルを開かないための世代番号
  let generation = 0;
  let removeChannel: (() => void) | null = null;

  function closeChannel() {
    removeChannel?.();
    removeChannel = null;
  }

  function connect() {
    const current = ++generation;
    void fetchFamilyChildIds().then((childIds) => {
      if (cancelled || current !== generation) return;
      closeChannel();
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
  }

  // 家族構成が変わったら張り直したうえで再取得させる。子供削除に伴う QuestInstance の DELETE は
  // フィルタ付き購読には届かない（Supabase の仕様: replica identity FULL が必要）ため、ここで補う
  function onFamilyChanged() {
    connect();
    onChange();
  }

  familyChangeListeners.add(onFamilyChanged);
  connect();

  return () => {
    cancelled = true;
    familyChangeListeners.delete(onFamilyChanged);
    closeChannel();
  };
}
