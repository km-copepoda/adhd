"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
 *
 * 注意: `transform` は呼び出し側がインラインのアロー関数を渡すことが多い。
 * `transform` を fetch 処理の依存配列に含めてしまうと、毎レンダーで新しい参照になり
 * fetch 用コールバックが再生成 → 副作用が再実行 → 無限フェッチループになる。
 * そのため `transform` は ref に退避して常に最新版を参照し、
 * fetch 用コールバックの identity は `url` のみに依存させる。
 * ref への書き込みはレンダー中ではなく専用 effect で行う
 * （レンダー中の ref 書き込みは react-hooks/refs の対象になるため）。
 *
 * 注意（set-state-in-effect）: マウント時・url変更時にデータをfetchする前に
 * ローディング状態を同期的に true へ更新している。このプロジェクトで標準的な
 * fetch-in-effect パターンであり、React Compiler の最適化対象からは外れるが
 * 影響は限定的なため eslint-disable で明示的に許容する
 * （方針決定は docs/decisions.md 参照）。
 */
export function useApiFetch<T>(
  url: string | null,
  transform?: (raw: T) => T,
): UseApiFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const transformRef = useRef(transform);
  useEffect(() => {
    transformRef.current = transform;
  });

  const fetchData = useCallback(() => {
    if (!url) return;
    setError(null);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<T>;
      })
      .then((d) => {
        const currentTransform = transformRef.current;
        setData(currentTransform ? currentTransform(d) : d);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "Unknown error");
        setData(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [url]);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!url) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- マウント時・url変更時にfetchを開始する前にローディング状態を同期的に更新する、fetch-in-effectパターン（このプロジェクトの標準パターン。docs/decisions.md参照）。React Compilerの最適化対象外になるが影響は限定的。
    setLoading(true);
    fetchData();
  }, [url, fetchData]);

  return { data, loading, error, setData, refetch };
}
