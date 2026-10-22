// @vitest-environment jsdom
// クエスト画面の宝箱件数（QuestStatusCard の表示可否に使う）も TreasureLog の Realtime で取り直す。
// 承認は親の端末で起きるため、window の "treasure-changed" だけでは子供の画面に届かない。
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

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => {
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
vi.mock("@/components/LoadingSpinner", () => ({ default: () => <div data-testid="loading-spinner" /> }));
vi.mock("@/components/MonsterMiniCard", () => ({ default: () => <div /> }));
vi.mock("@/components/child/TreasureStock", () => ({ default: () => <div /> }));
vi.mock("@/components/child/QuestStatusCard", () => ({
  default: () => <div data-testid="quest-status-card" />,
}));

import ChildQuestsPage from "@/app/app/child/quests/page";

let treasureStatus = { locked: 0, unlocked: 0 };

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

beforeEach(() => {
  vi.clearAllMocks();
  subscriptions.length = 0;
  treasureStatus = { locked: 0, unlocked: 0 };
  mockFetch();
});

afterEach(() => {
  cleanup();
});

describe("child quests page - 宝箱件数の Realtime 反映", () => {
  it("宝箱0件・クエスト0件の状態から TreasureLog の変更を受けたら QuestStatusCard が表示される", async () => {
    await act(async () => {
      render(<ChildQuestsPage />);
    });
    await waitFor(() => expect(statusCalls()).toBeGreaterThan(0));
    expect(screen.queryByTestId("quest-status-card")).toBeNull();
    expect(treasureLogHandlers()).toHaveLength(1);

    const before = statusCalls();
    treasureStatus = { locked: 0, unlocked: 1 };
    await act(async () => {
      treasureLogHandlers()[0]({ eventType: "UPDATE" });
    });

    await waitFor(() => expect(screen.getByTestId("quest-status-card")).toBeTruthy());
    expect(statusCalls()).toBe(before + 1);
  });

  it("アンマウントで TreasureLog の購読を解除する", async () => {
    let unmount: () => void = () => {};
    await act(async () => {
      ({ unmount } = render(<ChildQuestsPage />));
    });
    await waitFor(() => expect(treasureLogHandlers()).toHaveLength(1));

    const before = unsubscribe.mock.calls.length;
    unmount();
    // useChildQuests の QuestInstance 購読ぶんも含めて、少なくとも1回は増える
    expect(unsubscribe.mock.calls.length).toBeGreaterThan(before);
  });
});
