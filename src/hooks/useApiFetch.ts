"use client";

import { useCallback, useEffect, useState } from "react";

type UseApiFetchResult<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  setData: (data: T | null) => void;
  refetch: () => void;
};

/**
 * シンプルな API フェッチフック。
 * - 初回レンダリング時に自動フェッチ
 * - refetch で再取得
 * - transform で取得データを加工可能
 */
export function useApiFetch<T>(
  url: string | null,
  transform?: (raw: T) => T,
): UseApiFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(() => {
    if (!url) return;
    setLoading(true);
    setError(null);
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: T) => {
        setData(transform ? transform(d) : d);
      })
      .catch(e => {
        setError(e instanceof Error ? e.message : "Unknown error");
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [url]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, setData, refetch };
}
