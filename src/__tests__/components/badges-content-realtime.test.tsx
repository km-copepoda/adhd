// @vitest-environment jsdom
// Issue #161: BadgesContent は "badge-changes" 専用チャンネルではなく
// subscribeChildRealtime("UserBadge", ...) を使う。親モード（enableRealtime=false）は
// subscribeChildRealtime も Supabase チャンネルも使わず visibilitychange のみで再取得する。
import { cleanup, render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const unsubscribe = vi.fn();
const subscribeChildRealtime = vi.fn<(table: string, handler: (p: unknown) => void) => () => void>(() => unsubscribe);
vi.mock("@/lib/childRealtime", () => ({
  subscribeChildRealtime: (table: string, handler: (p: unknown) => void) => subscribeChildRealtime(table, handler),
}));

const channelFactory = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: (name: string) => {
      channelFactory(name);
      const ch = { on: () => ch, subscribe: () => ch };
      return ch;
    },
    removeChannel: vi.fn(),
  }),
}));

import BadgesContent from "@/components/child/BadgesContent";

const PAYLOAD = { badges: [], unlockedCount: 2, totalCount: 10, newlyUnlocked: [] };

function mockFetch() {
  global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify(PAYLOAD), { status: 200, headers: { "Content-Type": "application/json" } })),
  ) as unknown as typeof fetch;
}
const fetchCalls = () => (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  setVisibility("visible");
  mockFetch();
});

afterEach(() => {
  cleanup();
});

describe("BadgesContent (enableRealtime=true)", () => {
  it('subscribeChildRealtime("UserBadge", handler) で購読し、専用チャンネルは作らない', async () => {
    render(<BadgesContent />);
    await waitFor(() => expect(fetchCalls()).toBe(1));

    expect(subscribeChildRealtime).toHaveBeenCalledTimes(1);
    expect(subscribeChildRealtime.mock.calls[0][0]).toBe("UserBadge");
    expect(typeof subscribeChildRealtime.mock.calls[0][1]).toBe("function");
    expect(channelFactory).not.toHaveBeenCalled();
  });

  it("UserBadge の INSERT を受けたら fetchUrl を再取得する", async () => {
    render(<BadgesContent fetchUrl="/api/badges?x=1" />);
    await waitFor(() => expect(fetchCalls()).toBe(1));

    const handler = subscribeChildRealtime.mock.calls[0][1] as (p: unknown) => void;
    handler({ eventType: "INSERT" });

    await waitFor(() => expect(fetchCalls()).toBe(2));
    const urls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map(([u]) => String(u));
    expect(urls).toEqual(["/api/badges?x=1", "/api/badges?x=1"]);
  });

  it("アンマウントで unsubscribe が1回呼ばれる", async () => {
    const { unmount } = render(<BadgesContent />);
    await waitFor(() => expect(fetchCalls()).toBe(1));
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("visibilitychange（visible）でも再取得する。hidden では再取得しない", async () => {
    render(<BadgesContent />);
    await waitFor(() => expect(fetchCalls()).toBe(1));

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(fetchCalls()).toBe(1);

    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(fetchCalls()).toBe(2));
  });

  it("アンマウント後は visibilitychange で再取得しない", async () => {
    const { unmount } = render(<BadgesContent />);
    await waitFor(() => expect(fetchCalls()).toBe(1));
    unmount();

    document.dispatchEvent(new Event("visibilitychange"));
    expect(fetchCalls()).toBe(1);
  });
});

describe("BadgesContent (enableRealtime=false: 親モード)", () => {
  const props = { fetchUrl: "/api/parent/child-view/badges?childId=c1", trackVisit: false, enableRealtime: false } as const;

  it("subscribeChildRealtime も Supabase チャンネルも使わない", async () => {
    render(<BadgesContent {...props} />);
    await waitFor(() => expect(fetchCalls()).toBe(1));

    expect(subscribeChildRealtime).not.toHaveBeenCalled();
    expect(channelFactory).not.toHaveBeenCalled();
  });

  it("visibilitychange（visible）では再取得する", async () => {
    render(<BadgesContent {...props} />);
    await waitFor(() => expect(fetchCalls()).toBe(1));

    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(fetchCalls()).toBe(2));
  });

  it("アンマウントしても unsubscribe は呼ばれない（購読していない）", async () => {
    const { unmount } = render(<BadgesContent {...props} />);
    await waitFor(() => expect(fetchCalls()).toBe(1));
    unmount();
    expect(unsubscribe).not.toHaveBeenCalled();
  });
});
