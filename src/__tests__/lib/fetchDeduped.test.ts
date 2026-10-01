import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDeduped, invalidateDeduped } from "@/lib/fetchDeduped";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchDeduped", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("同じ URL への同時 GET は1回の fetch にまとまり、各呼び出しが独立して json() を読める", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ a: 1 }));

    const [r1, r2, r3] = await Promise.all([
      fetchDeduped("/api/x"),
      fetchDeduped("/api/x"),
      fetchDeduped("/api/x"),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await r1.json()).toEqual({ a: 1 });
    expect(await r2.json()).toEqual({ a: 1 });
    expect(await r3.json()).toEqual({ a: 1 });
  });

  it("完了後の呼び出しは新しく fetch する（結果をキャッシュしない）", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ n: 1 }))
      .mockResolvedValueOnce(jsonResponse({ n: 2 }));

    const first = await fetchDeduped("/api/x");
    expect(await first.json()).toEqual({ n: 1 });
    const second = await fetchDeduped("/api/x");
    expect(await second.json()).toEqual({ n: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("URL が違えばまとめない", async () => {
    fetchMock.mockImplementation(async (url: string) => jsonResponse({ url }));

    const [a, b] = await Promise.all([fetchDeduped("/api/a"), fetchDeduped("/api/b")]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await a.json()).toEqual({ url: "/api/a" });
    expect(await b.json()).toEqual({ url: "/api/b" });
  });

  it("cache オプションが違えばまとめない（no-store とは別扱い）", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({}));

    await Promise.all([
      fetchDeduped("/api/x"),
      fetchDeduped("/api/x", { cache: "no-store" }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("GET 以外（POST）は決してまとめない", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({}));

    await Promise.all([
      fetchDeduped("/api/x", { method: "POST" }),
      fetchDeduped("/api/x", { method: "POST" }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ステータスコードは全員に伝わる（404 は ok=false）", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "no" }, 404));

    const [r1, r2] = await Promise.all([fetchDeduped("/api/x"), fetchDeduped("/api/x")]);

    expect(r1.ok).toBe(false);
    expect(r1.status).toBe(404);
    expect(r2.ok).toBe(false);
    expect(r2.status).toBe(404);
  });

  it("fetch が失敗したら全員に reject が伝わり、次の呼び出しは再試行される", async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const results = await Promise.allSettled([fetchDeduped("/api/x"), fetchDeduped("/api/x")]);
    expect(results[0].status).toBe("rejected");
    expect(results[1].status).toBe("rejected");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const retry = await fetchDeduped("/api/x");
    expect(await retry.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("呼び出し側の AbortSignal は共有 fetch に渡さず、abort した呼び出しだけが AbortError になる", async () => {
    let resolveFetch!: (r: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const controller = new AbortController();

    const aborted = fetchDeduped("/api/x", { signal: controller.signal });
    const other = fetchDeduped("/api/x");
    controller.abort();
    resolveFetch(jsonResponse({ shared: true }));

    await expect(aborted).rejects.toMatchObject({ name: "AbortError" });
    expect(await (await other).json()).toEqual({ shared: true });
    // 共有 fetch には signal を渡さない（1人の abort で全員が巻き添えにならない）
    const passedInit = fetchMock.mock.calls[0][1] as RequestInit | undefined;
    expect(passedInit?.signal).toBeUndefined();
  });

  it("すでに abort 済みの signal で呼ぶと即 AbortError（fetch は開始しない）", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(fetchDeduped("/api/x", { signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  describe("invalidateDeduped（イベント起点の再取得は古い進行中リクエストに相乗りしない）", () => {
    function deferred() {
      let resolve!: (r: Response) => void;
      const promise = new Promise<Response>((r) => {
        resolve = r;
      });
      return { promise, resolve };
    }

    it("無効化後の呼び出しは新しく fetch し、古いリクエストの待ち手は古い結果を受け取る", async () => {
      const first = deferred();
      const second = deferred();
      fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

      const oldCall = fetchDeduped("/api/x");
      invalidateDeduped();
      const newCall = fetchDeduped("/api/x");
      expect(fetchMock).toHaveBeenCalledTimes(2);

      first.resolve(jsonResponse({ v: "old" }));
      second.resolve(jsonResponse({ v: "new" }));
      expect(await (await oldCall).json()).toEqual({ v: "old" });
      expect(await (await newCall).json()).toEqual({ v: "new" });
    });

    it("無効化の後に来た複数の呼び出しは、新しい1本の fetch に相乗りする", async () => {
      const first = deferred();
      const second = deferred();
      fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

      fetchDeduped("/api/x");
      invalidateDeduped();
      const a = fetchDeduped("/api/x");
      const b = fetchDeduped("/api/x");
      expect(fetchMock).toHaveBeenCalledTimes(2);

      first.resolve(jsonResponse({}));
      second.resolve(jsonResponse({ v: "new" }));
      expect(await (await a).json()).toEqual({ v: "new" });
      expect(await (await b).json()).toEqual({ v: "new" });
    });

    it("古いリクエストが先に完了しても、新しい進行中リクエストへの相乗りは壊れない", async () => {
      const first = deferred();
      const second = deferred();
      fetchMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

      const oldCall = fetchDeduped("/api/x");
      invalidateDeduped();
      const newCall = fetchDeduped("/api/x");

      first.resolve(jsonResponse({ v: "old" }));
      await oldCall;
      // 古い方の完了後も、新しい方はまだ進行中 → 後から来た呼び出しは相乗りできる
      const late = fetchDeduped("/api/x");
      expect(fetchMock).toHaveBeenCalledTimes(2);

      second.resolve(jsonResponse({ v: "new" }));
      expect(await (await newCall).json()).toEqual({ v: "new" });
      expect(await (await late).json()).toEqual({ v: "new" });
    });

    it("URL を指定すると、その URL だけを無効化する", async () => {
      const a1 = deferred();
      const b1 = deferred();
      const a2 = deferred();
      fetchMock
        .mockReturnValueOnce(a1.promise)
        .mockReturnValueOnce(b1.promise)
        .mockReturnValueOnce(a2.promise);

      fetchDeduped("/api/a");
      fetchDeduped("/api/b");
      invalidateDeduped("/api/a");
      fetchDeduped("/api/a"); // 新しく fetch
      fetchDeduped("/api/b"); // 相乗り（無効化されていない）

      expect(fetchMock).toHaveBeenCalledTimes(3);
      a1.resolve(jsonResponse({}));
      b1.resolve(jsonResponse({}));
      a2.resolve(jsonResponse({}));
    });

    it("進行中のリクエストが無いときに呼んでも何も起きない", () => {
      expect(() => invalidateDeduped()).not.toThrow();
      expect(() => invalidateDeduped("/api/none")).not.toThrow();
    });
  });
});
