// @vitest-environment jsdom
import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useApiFetch } from "@/hooks/useApiFetch";

describe("useApiFetch", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ foo: "bar" }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("マウント時にurlが設定されていれば1回だけfetchする", async () => {
    const { result } = renderHook(() => useApiFetch<{ foo: string }>("/api/test"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ foo: "bar" });
    expect(result.current.error).toBeNull();
  });

  it("urlがnullのときはfetchしない", async () => {
    const { result } = renderHook(() => useApiFetch<{ foo: string }>(null));

    // loadingの初期値はtrueのままフェッチされないことを確認するため、
    // 少し待ってからアサーションする
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it("urlが変わったときに1回だけ再フェッチする", async () => {
    const { result, rerender } = renderHook(
      ({ url }: { url: string | null }) => useApiFetch<{ foo: string }>(url),
      { initialProps: { url: "/api/a" } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(1);

    rerender({ url: "/api/b" });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/b");
  });

  it("refetch()を手動で呼ぶと再フェッチされる", async () => {
    const { result } = renderHook(() => useApiFetch<{ foo: string }>("/api/test"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it("回帰テスト: transformに毎レンダー新規のインラインアロー関数を渡しても無限フェッチループが起きず1回で収まる", async () => {
    // transform を毎回新しい参照で渡す (呼び出し側が useCallback していないケースを再現)
    const { result, rerender } = renderHook(() =>
      useApiFetch<{ foo: string }>("/api/test", (d) => ({ foo: d.foo.toUpperCase() })),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual({ foo: "BAR" });

    // 何度再レンダーしても(transformが新規関数でも)fetchは増えない
    rerender();
    rerender();
    rerender();

    // 非同期の余地を与えてから確認
    await act(async () => {
      await new Promise(r => setTimeout(r, 0));
    });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("APIエラー時はerrorがセットされdataがnullになる", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      }),
    );

    const { result } = renderHook(() => useApiFetch<{ foo: string }>("/api/test"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("HTTP 500");
    expect(result.current.data).toBeNull();
  });

  it("setDataで手動にデータを更新できる", async () => {
    const { result } = renderHook(() => useApiFetch<{ foo: string }>("/api/test"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setData({ foo: "baz" });
    });

    expect(result.current.data).toEqual({ foo: "baz" });
  });
});
