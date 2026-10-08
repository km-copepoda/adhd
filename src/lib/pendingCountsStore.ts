export type PendingCounts = { approvals: number; tasks: number };

type Options = {
  fetchCounts: () => Promise<PendingCounts>;
  /** 最初の購読時に呼ばれ、クリーンアップ関数を返す（Realtime 等の購読用） */
  onActive?: () => () => void;
  debounceMs?: number;
};

const DEFAULT_DEBOUNCE_MS = 500;

/**
 * 承認待ち件数の共有ストア（useSyncExternalStore 用）。
 * 購読者が1人以上いる間だけ fetch / onActive を動かし、
 * refresh はデバウンス、in-flight 中の要求は完了後に1回へ合流させる。
 */
export function createPendingCountsStore({
  fetchCounts,
  onActive,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: Options) {
  let snapshot: PendingCounts = { approvals: 0, tasks: 0 };
  const listeners = new Set<{ fn: () => void }>();
  let cleanup: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;
  let followUp = false;

  const isActive = () => listeners.size > 0;

  function clearTimer() {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  async function run(): Promise<void> {
    if (!isActive()) return;
    if (inFlight) {
      followUp = true;
      return;
    }
    inFlight = true;
    try {
      const next = await fetchCounts();
      if (
        isActive() &&
        (next.approvals !== snapshot.approvals || next.tasks !== snapshot.tasks)
      ) {
        snapshot = { approvals: next.approvals, tasks: next.tasks };
        for (const l of [...listeners]) l.fn();
      }
    } catch {
      // 失敗時は直前の値を保持
    } finally {
      inFlight = false;
      if (followUp) {
        followUp = false;
        void run();
      }
    }
  }

  function refreshNow() {
    if (!isActive()) return;
    clearTimer();
    void run();
  }

  function refresh() {
    if (!isActive()) return;
    clearTimer();
    timer = setTimeout(() => {
      timer = undefined;
      void run();
    }, debounceMs);
  }

  function subscribe(listener: () => void) {
    const entry = { fn: listener };
    listeners.add(entry);
    if (listeners.size === 1) {
      cleanup = onActive?.();
      void run();
    }
    return () => {
      if (!listeners.delete(entry)) return;
      if (listeners.size === 0) {
        clearTimer();
        followUp = false;
        const c = cleanup;
        cleanup = undefined;
        c?.();
      }
    };
  }

  return {
    subscribe,
    getSnapshot: () => snapshot,
    refresh,
    refreshNow,
  };
}
