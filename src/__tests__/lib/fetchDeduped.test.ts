import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDeduped } from "@/lib/fetchDeduped";

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
});
