"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { onApprovalsUpdated } from "@/lib/approval-events";
import {
  createPendingCountsStore,
  type PendingCounts,
} from "@/lib/pendingCountsStore";

const INITIAL_COUNTS: PendingCounts = { approvals: 0, tasks: 0 };

async function fetchCounts(): Promise<PendingCounts> {
  const res = await fetch("/api/nav/pending-counts");
  if (!res.ok) throw new Error(`pending-counts ${res.status}`);
  const data = await res.json();
  return { approvals: data.approvals ?? 0, tasks: data.tasks ?? 0 };
}

type Store = ReturnType<typeof createPendingCountsStore>;
let store: Store | undefined;

// SSR で副作用が出ないよう、クライアントで最初に使われた時に生成する
function getStore(): Store {
  if (!store) {
    const created: Store = createPendingCountsStore({
      fetchCounts,
      onActive: () => {
        const unsubApproval = onApprovalsUpdated(() => created.refreshNow());

        const supabase = createClient();
        const refresh = () => created.refresh();
        const channel = supabase
          .channel("pending-counts")
          .on("postgres_changes", { event: "*", schema: "public", table: "QuestInstance" }, refresh)
          .on("postgres_changes", { event: "*", schema: "public", table: "TaskTemplate" }, refresh)
          .on("postgres_changes", { event: "*", schema: "public", table: "TreasureLog" }, refresh)
          .subscribe();

        const onVisible = () => {
          if (document.visibilityState === "visible") created.refresh();
        };
        document.addEventListener("visibilitychange", onVisible);

        return () => {
          unsubApproval();
          supabase.removeChannel(channel);
          document.removeEventListener("visibilitychange", onVisible);
        };
      },
    });
    store = created;
  }
  return store;
}

const subscribe = (listener: () => void) => getStore().subscribe(listener);
const getSnapshot = () => getStore().getSnapshot();
const getServerSnapshot = () => INITIAL_COUNTS;

export function usePendingCounts(): PendingCounts {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
