"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { onApprovalsUpdated } from "@/lib/approval-events";

type PendingCounts = { approvals: number; tasks: number };

export function usePendingCounts(): PendingCounts {
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
      .channel("pending-counts-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "QuestInstance" }, fetchCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "TaskTemplate" }, fetchCounts)
      .subscribe();

    return () => {
      unsubApproval();
      supabase.removeChannel(channel);
    };
  }, []);

  return counts;
}
