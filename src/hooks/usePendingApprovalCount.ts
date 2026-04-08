"use client";

import { useEffect, useState } from "react";

export function usePendingApprovalCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch("/api/approve/count");
        if (res.ok) {
          const data = await res.json();
          setCount(data.count ?? 0);
        }
      } catch {
        // ネットワークエラーは無視
      }
    }

    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    window.addEventListener("approvalUpdated", fetchCount);
    return () => {
      clearInterval(interval);
      window.removeEventListener("approvalUpdated", fetchCount);
    };
  }, []);

  return count;
}
