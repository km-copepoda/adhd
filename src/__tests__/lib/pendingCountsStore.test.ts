import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { createPendingCountsStore } from "@/lib/pendingCountsStore";

type Counts = { approvals: number; tasks: number };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

describe("createPendingCountsStore", () => {
  let fetchCounts: Mock<() => Promise<Counts>>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchCounts = vi.fn<() => Promise<Counts>>().mockResolvedValue({ approvals: 1, tasks: 2 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("初期状態と購読", () => {
    it("初期スナップショットは {approvals:0,tasks:0}", () => {
      const store = createPendingCountsStore({ fetchCounts });
      expect(store.getSnapshot()).toEqual({ approvals: 0, tasks: 0 });
    });

    it("購読者がいない間は fetch しない", async () => {
      const store = createPendingCountsStore({ fetchCounts });
      store.refresh();
      store.refreshNow();
      await vi.advanceTimersByTimeAsync(1000);
      expect(fetchCounts).not.toHaveBeenCalled();
    });

    it("最初の subscribe で onActive を1回呼び、即時に fetch を1回行う", async () => {
      const onActive = vi.fn(() => () => {});
      const store = createPendingCountsStore({ fetchCounts, onActive });
      store.subscribe(() => {});
      expect(onActive).toHaveBeenCalledTimes(1);
      expect(fetchCounts).toHaveBeenCalledTimes(1);
      await flush();
      expect(store.getSnapshot()).toEqual({ approvals: 1, tasks: 2 });
    });

    it("2人目以降の subscribe では onActive も fetch も追加されない", async () => {
      const onActive = vi.fn(() => () => {});
      const store = createPendingCountsStore({ fetchCounts, onActive });
      store.subscribe(() => {});
      store.subscribe(() => {});
      store.subscribe(() => {});
      await flush();
      expect(onActive).toHaveBeenCalledTimes(1);
      expect(fetchCounts).toHaveBeenCalledTimes(1);
    });

    it("最後の購読解除でクリーンアップを1回呼ぶ（途中の解除では呼ばない）", () => {
      const cleanup = vi.fn();
      const store = createPendingCountsStore({
        fetchCounts,
        onActive: () => cleanup,
      });
      const un1 = store.subscribe(() => {});
      const un2 = store.subscribe(() => {});
      un1();
      expect(cleanup).not.toHaveBeenCalled();
      un2();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("同じ解除関数を2回呼んでもクリーンアップは1回", () => {
      const cleanup = vi.fn();
      const store = createPendingCountsStore({
        fetchCounts,
        onActive: () => cleanup,
      });
      const un = store.subscribe(() => {});
      un();
      un();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("全解除後に再購読すると onActive と fetch が再度走る", async () => {
      const onActive = vi.fn(() => () => {});
      const store = createPendingCountsStore({ fetchCounts, onActive });
      store.subscribe(() => {})();
      await flush();
      store.subscribe(() => {});
      await flush();
      expect(onActive).toHaveBeenCalledTimes(2);
      expect(fetchCounts).toHaveBeenCalledTimes(2);
    });

    it("onActive 未指定でも動作する", async () => {
      const store = createPendingCountsStore({ fetchCounts });
      const un = store.subscribe(() => {});
      await flush();
      expect(() => un()).not.toThrow();
    });
  });

  describe("refresh のデバウンス", () => {
    async function setup(debounceMs?: number) {
      const store = createPendingCountsStore({ fetchCounts, debounceMs });
      store.subscribe(() => {});
      await flush();
      fetchCounts.mockClear();
      return store;
    }

    it("499ms では fetch されず 500ms で fetch される（既定）", async () => {
      const store = await setup();
      store.refresh();
      await vi.advanceTimersByTimeAsync(499);
      expect(fetchCounts).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchCounts).toHaveBeenCalledTimes(1);
    });

    it("連打しても最後の呼び出しから 500ms 後に1回だけ fetch", async () => {
      const store = await setup();
      store.refresh();
      await vi.advanceTimersByTimeAsync(300);
      store.refresh();
      await vi.advanceTimersByTimeAsync(499);
      expect(fetchCounts).not.toHaveBeenCalled();
      store.refresh();
      await vi.advanceTimersByTimeAsync(499);
      expect(fetchCounts).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchCounts).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(2000);
      expect(fetchCounts).toHaveBeenCalledTimes(1);
    });

    it("debounceMs を指定できる", async () => {
      const store = await setup(100);
      store.refresh();
      await vi.advanceTimersByTimeAsync(99);
      expect(fetchCounts).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchCounts).toHaveBeenCalledTimes(1);
    });

    it("最後の購読解除で保留中のデバウンスタイマーは破棄される", async () => {
      const store = createPendingCountsStore({ fetchCounts });
      const un = store.subscribe(() => {});
      await flush();
      fetchCounts.mockClear();
      store.refresh();
      un();
      await vi.advanceTimersByTimeAsync(1000);
      expect(fetchCounts).not.toHaveBeenCalled();
    });
  });

  describe("refreshNow", () => {
    it("デバウンスなしで即 fetch し、保留タイマーはキャンセルされる", async () => {
      const store = createPendingCountsStore({ fetchCounts });
      store.subscribe(() => {});
      await flush();
      fetchCounts.mockClear();

      store.refresh();
      await vi.advanceTimersByTimeAsync(200);
      store.refreshNow();
      expect(fetchCounts).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(2000);
      expect(fetchCounts).toHaveBeenCalledTimes(1);
    });
  });

  describe("in-flight 中の合流", () => {
    it("in-flight 中の refreshNow は並行 fetch せず、完了後に1回だけ追従する（複数回呼んでも1回）", async () => {
      const d1 = deferred<Counts>();
      fetchCounts.mockReturnValueOnce(d1.promise);
      const store = createPendingCountsStore({ fetchCounts });
      store.subscribe(() => {});
      expect(fetchCounts).toHaveBeenCalledTimes(1);

      store.refreshNow();
      store.refreshNow();
      store.refreshNow();
      expect(fetchCounts).toHaveBeenCalledTimes(1);

      d1.resolve({ approvals: 5, tasks: 5 });
      await flush();
      expect(fetchCounts).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(2000);
      expect(fetchCounts).toHaveBeenCalledTimes(2);
    });

    it("in-flight 中の refresh はデバウンス経過後も並行 fetch せず、完了後に1回だけ追従する", async () => {
      const d1 = deferred<Counts>();
      fetchCounts.mockReturnValueOnce(d1.promise);
      const store = createPendingCountsStore({ fetchCounts });
      store.subscribe(() => {});

      store.refresh();
      store.refresh();
      await vi.advanceTimersByTimeAsync(600);
      expect(fetchCounts).toHaveBeenCalledTimes(1);

      d1.resolve({ approvals: 1, tasks: 1 });
      await flush();
      expect(fetchCounts).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(2000);
      expect(fetchCounts).toHaveBeenCalledTimes(2);
    });

    it("追従 fetch がない場合は完了後に余分な fetch をしない", async () => {
      const store = createPendingCountsStore({ fetchCounts });
      store.subscribe(() => {});
      await vi.advanceTimersByTimeAsync(2000);
      expect(fetchCounts).toHaveBeenCalledTimes(1);
    });
  });

  describe("snapshot と通知", () => {
    it("fetch 成功で snapshot が更新され listener が通知される", async () => {
      const store = createPendingCountsStore({ fetchCounts });
      const listener = vi.fn();
      store.subscribe(listener);
      await flush();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(store.getSnapshot()).toEqual({ approvals: 1, tasks: 2 });
    });

    it("全 listener に通知される", async () => {
      const store = createPendingCountsStore({ fetchCounts });
      const a = vi.fn();
      const b = vi.fn();
      store.subscribe(a);
      store.subscribe(b);
      await flush();
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });

    it("同値の結果では通知せず参照も変わらない", async () => {
      const store = createPendingCountsStore({ fetchCounts });
      const listener = vi.fn();
      store.subscribe(listener);
      await flush();
      const before = store.getSnapshot();
      listener.mockClear();

      store.refreshNow();
      await flush();
      expect(fetchCounts).toHaveBeenCalledTimes(2);
      expect(listener).not.toHaveBeenCalled();
      expect(store.getSnapshot()).toBe(before);
    });

    it("値が変わらない限り getSnapshot は同一参照を返す", async () => {
      const store = createPendingCountsStore({ fetchCounts });
      store.subscribe(() => {});
      await flush();
      expect(store.getSnapshot()).toBe(store.getSnapshot());
    });

    it("片方の値だけ変わっても更新・通知される", async () => {
      const store = createPendingCountsStore({ fetchCounts });
      const listener = vi.fn();
      store.subscribe(listener);
      await flush();
      listener.mockClear();
      const before = store.getSnapshot();

      fetchCounts.mockResolvedValue({ approvals: 1, tasks: 3 });
      store.refreshNow();
      await flush();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(store.getSnapshot()).not.toBe(before);
      expect(store.getSnapshot()).toEqual({ approvals: 1, tasks: 3 });
    });

    it("初回 fetch が {0,0} を返した場合は通知せず初期参照を保つ", async () => {
      fetchCounts.mockResolvedValue({ approvals: 0, tasks: 0 });
      const store = createPendingCountsStore({ fetchCounts });
      const initial = store.getSnapshot();
      const listener = vi.fn();
      store.subscribe(listener);
      await flush();
      expect(listener).not.toHaveBeenCalled();
      expect(store.getSnapshot()).toBe(initial);
    });

    it("購読解除した listener は呼ばれない", async () => {
      const store = createPendingCountsStore({ fetchCounts });
      const gone = vi.fn();
      const kept = vi.fn();
      const un = store.subscribe(gone);
      store.subscribe(kept);
      un();
      await flush();
      expect(gone).not.toHaveBeenCalled();
      expect(kept).toHaveBeenCalledTimes(1);
    });

    it("購読解除後に完了した fetch は listener を呼ばない", async () => {
      const d = deferred<Counts>();
      fetchCounts.mockReturnValueOnce(d.promise);
      const store = createPendingCountsStore({ fetchCounts });
      const listener = vi.fn();
      const un = store.subscribe(listener);
      un();
      d.resolve({ approvals: 9, tasks: 9 });
      await flush();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("fetch 失敗", () => {
    it("失敗時は直前の値を保持し、例外を投げず、通知もしない", async () => {
      const store = createPendingCountsStore({ fetchCounts });
      const listener = vi.fn();
      store.subscribe(listener);
      await flush();
      listener.mockClear();
      const before = store.getSnapshot();

      fetchCounts.mockRejectedValueOnce(new Error("network"));
      store.refreshNow();
      await flush();
      expect(listener).not.toHaveBeenCalled();
      expect(store.getSnapshot()).toBe(before);
    });

    it("初回 fetch の失敗でも初期値のまま、unhandled rejection を起こさない", async () => {
      fetchCounts.mockRejectedValueOnce(new Error("boom"));
      const store = createPendingCountsStore({ fetchCounts });
      const listener = vi.fn();
      expect(() => store.subscribe(listener)).not.toThrow();
      await flush();
      expect(store.getSnapshot()).toEqual({ approvals: 0, tasks: 0 });
      expect(listener).not.toHaveBeenCalled();
    });

    it("同期的に throw する fetchCounts でも例外を投げない", async () => {
      fetchCounts.mockImplementationOnce(() => {
        throw new Error("sync");
      });
      const store = createPendingCountsStore({ fetchCounts });
      expect(() => store.subscribe(() => {})).not.toThrow();
      await flush();
      expect(store.getSnapshot()).toEqual({ approvals: 0, tasks: 0 });
    });

    it("失敗後も次の refresh は動く", async () => {
      fetchCounts.mockRejectedValueOnce(new Error("x"));
      const store = createPendingCountsStore({ fetchCounts });
      const listener = vi.fn();
      store.subscribe(listener);
      await flush();

      store.refresh();
      await vi.advanceTimersByTimeAsync(500);
      expect(fetchCounts).toHaveBeenCalledTimes(2);
      expect(store.getSnapshot()).toEqual({ approvals: 1, tasks: 2 });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("in-flight が失敗しても保留中の追従 fetch は実行される", async () => {
      const d1 = deferred<Counts>();
      fetchCounts.mockReturnValueOnce(d1.promise);
      const store = createPendingCountsStore({ fetchCounts });
      store.subscribe(() => {});
      store.refreshNow();
      d1.reject(new Error("fail"));
      await flush();
      expect(fetchCounts).toHaveBeenCalledTimes(2);
      expect(store.getSnapshot()).toEqual({ approvals: 1, tasks: 2 });
    });
  });
});
