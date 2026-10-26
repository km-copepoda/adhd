// @vitest-environment jsdom
// 親が承認すると TreasureLog が LOCKED → UNLOCKED に更新される。子供のクエスト画面は
// TreasureLog の Realtime を受けて宝箱件数を取り直し、画面更新なしで「あける」を押せるようにする。
// 購読は共有チャンネル（subscribeChildRealtime）に相乗りし、専用チャンネルは作らない。
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Handler = (p: unknown) => void;
const unsubscribe = vi.fn();
const subscriptions: { table: string; handler: Handler }[] = [];
vi.mock("@/lib/childRealtime", () => ({
  subscribeChildRealtime: (table: string, handler: Handler) => {
    subscriptions.push({ table, handler });
    return unsubscribe;
  },
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

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

import TreasureStock from "@/components/child/TreasureStock";

let treasureStatus = { locked: 1, unlocked: 0 };

function mockFetch() {
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/treasures/status")) {
      const body = { ...treasureStatus };
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
    }
    if (url.includes("/api/quests/today")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
}

const statusCalls = () =>
  (global.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([u]) =>
    String(u).includes("/api/treasures/status"),
  ).length;

const treasureLogHandlers = () =>
  subscriptions.filter((s) => s.table === "TreasureLog").map((s) => s.handler);

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  subscriptions.length = 0;
  treasureStatus = { locked: 1, unlocked: 0 };
  setVisibility("visible");
  mockFetch();
});

afterEach(() => {
  cleanup();
});

describe("TreasureStock の Realtime 反映", () => {
  it('subscribeChildRealtime("TreasureLog", ...) で購読し、専用チャンネルは作らない', async () => {
    render(<TreasureStock variant="card" />);
    await waitFor(() => expect(statusCalls()).toBe(1));

    expect(treasureLogHandlers()).toHaveLength(1);
    expect(channelFactory).not.toHaveBeenCalled();
  });

  it("親の承認（TreasureLog UPDATE）を受けたら件数を取り直し、「あける」が押せるようになる", async () => {
    render(<TreasureStock variant="card" />);
    const button = await screen.findByRole("button", { name: /あける/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    treasureStatus = { locked: 0, unlocked: 1 };
    await act(async () => {
      treasureLogHandlers()[0]({ eventType: "UPDATE" });
    });

    await waitFor(() => {
      expect((screen.getByRole("button", { name: /あける/ }) as HTMLButtonElement).disabled).toBe(false);
    });
    expect(statusCalls()).toBe(2);
  });

  it("境界値: 宝箱0件（非表示）の状態から TreasureLog の変更を受けたら表示される", async () => {
    treasureStatus = { locked: 0, unlocked: 0 };
    render(<TreasureStock variant="card" />);
    await waitFor(() => expect(statusCalls()).toBe(1));
    expect(screen.queryByRole("button", { name: /あける/ })).toBeNull();

    treasureStatus = { locked: 0, unlocked: 1 };
    await act(async () => {
      treasureLogHandlers()[0]({ eventType: "INSERT" });
    });

    expect(await screen.findByRole("button", { name: /あける/ })).toBeTruthy();
  });

  it("アンマウントで購読を解除する", async () => {
    const { unmount } = render(<TreasureStock variant="card" />);
    await waitFor(() => expect(statusCalls()).toBe(1));
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("visibilitychange（visible）で取り直す。hidden では取り直さない", async () => {
    render(<TreasureStock variant="card" />);
    await waitFor(() => expect(statusCalls()).toBe(1));

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(statusCalls()).toBe(1);

    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await waitFor(() => expect(statusCalls()).toBe(2));
  });

  it("アンマウント後は visibilitychange で取り直さない", async () => {
    const { unmount } = render(<TreasureStock variant="card" />);
    await waitFor(() => expect(statusCalls()).toBe(1));
    unmount();

    document.dispatchEvent(new Event("visibilitychange"));
    expect(statusCalls()).toBe(1);
  });
});
