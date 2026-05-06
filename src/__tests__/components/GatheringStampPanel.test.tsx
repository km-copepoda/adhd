// @vitest-environment jsdom
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import GatheringStampPanel from "@/components/child/GatheringStampPanel";

// Supabase Realtime はテストでは購読しない（mountReplay の検証に集中）
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: function () {
        return this;
      },
      subscribe: function () {
        return this;
      },
    }),
    removeChannel: vi.fn(),
  }),
}));

const SEEN_KEY = "gathering:seenStampIds";

const members = [
  { id: "me", monsterName: "ぼく", isMe: true },
  { id: "other-1", monsterName: "ピカ", isMe: false },
  { id: "other-2", monsterName: "ガル", isMe: false },
];

function setupFetch(handlers: Record<string, () => unknown>) {
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [pattern, handler] of Object.entries(handlers)) {
      if (url.includes(pattern)) {
        const body = handler();
        return {
          ok: true,
          status: 200,
          json: async () => body,
        } as unknown as Response;
      }
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  }) as typeof fetch;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
});

describe("GatheringStampPanel — マウント時の未読再生", () => {
  it("マウント時に未読 Stamp をトーストとして表示する", async () => {
    setupFetch({
      "/api/gathering/stamp/today": () => ({ sentToday: false }),
      "/api/gathering/stamps/received-today": () => ({
        stamps: [
          { id: "s-1", senderId: "other-1", senderName: "ピカ" },
        ],
      }),
      "/api/quests/today": () => [
        { status: "PENDING" },
        { status: "PENDING" },
        { status: "PENDING" },
      ],
    });

    render(<GatheringStampPanel groupId="g-1" members={members} />);

    await waitFor(() => {
      expect(screen.getByText(/ピカ.*エール/)).toBeTruthy();
    });
  });

  it("既読 Stamp（localStorage に保存済み）はトーストしない", async () => {
    localStorage.setItem(SEEN_KEY, JSON.stringify(["s-1"]));
    setupFetch({
      "/api/gathering/stamp/today": () => ({ sentToday: false }),
      "/api/gathering/stamps/received-today": () => ({
        stamps: [
          { id: "s-1", senderId: "other-1", senderName: "ピカ" },
        ],
      }),
      "/api/quests/today": () => [],
    });

    render(<GatheringStampPanel groupId="g-1" members={members} />);

    // 100ms 待ってもトーストが出ないことを確認
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(screen.queryByText(/ピカ.*エール/)).toBeNull();
  });

  it("トースト表示後、Stamp ID が localStorage の seen に追加される", async () => {
    setupFetch({
      "/api/gathering/stamp/today": () => ({ sentToday: false }),
      "/api/gathering/stamps/received-today": () => ({
        stamps: [
          { id: "s-1", senderId: "other-1", senderName: "ピカ" },
          { id: "s-2", senderId: "other-2", senderName: "ガル" },
        ],
      }),
      "/api/quests/today": () => [],
    });

    render(<GatheringStampPanel groupId="g-1" members={members} />);

    await waitFor(() => {
      const seen = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
      expect(seen).toEqual(expect.arrayContaining(["s-1", "s-2"]));
    });
  });

  it("未読が1件もなければトーストは出ない", async () => {
    setupFetch({
      "/api/gathering/stamp/today": () => ({ sentToday: false }),
      "/api/gathering/stamps/received-today": () => ({ stamps: [] }),
      "/api/quests/today": () => [],
    });

    render(<GatheringStampPanel groupId="g-1" members={members} />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    // 「みんなにエールを送る」ボタンは表示されているが、「{name}からエール」のトーストは出ない
    expect(screen.queryByText(/からエール/)).toBeNull();
  });
});
