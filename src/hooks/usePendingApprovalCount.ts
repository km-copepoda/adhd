"use client";

import { useEffect, useState } from "react";

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
    const interval = setInterval(fetchCounts, 60_000);
    window.addEventListener("approvalUpdated", fetchCounts);
    return () => {
      clearInterval(interval);
      window.removeEventListener("approvalUpdated", fetchCounts);
    };
  }, []);

  return counts;
}
