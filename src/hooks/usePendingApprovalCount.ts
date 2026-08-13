"use client";

import { useEffect, useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { onApprovalsUpdated } from "@/lib/approval-events";

type PendingCounts = { approvals: number; tasks: number };

export function usePendingCounts(): PendingCounts {
  const id = useId();
  const [counts, setCounts] = useState<PendingCounts>({ approvals: 0, tasks: 0 });

  useEffect(() => {
    async function fetchCounts() {
      try {
        const res = await fetch("/api/nav/pending-counts");
        if (res.ok) {
          const data = await res.json();
          setCounts({ approvals: data.approvals ?? 0, tasks: data.tasks ?? 0 });
        }
      } catch {
        // ネットワークエラーは無視
      }
    }

    fetchCounts();

    // 承認操作後の直接通知（Realtime の補完）
    const unsubApproval = onApprovalsUpdated(fetchCounts);

    const supabase = createClient();
    const channel = supabase
      .channel(`pending-counts-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "QuestInstance" }, fetchCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "TaskTemplate" }, fetchCounts)
      .subscribe();

    const onVisible = () => { if (document.visibilityState === "visible") fetchCounts(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unsubApproval();
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id]);

  return counts;
}
