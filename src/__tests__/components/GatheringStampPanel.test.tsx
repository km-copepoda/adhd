// @vitest-environment jsdom
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import GatheringStampPanel from "@/components/child/GatheringStampPanel";
import { buildStampMessage, getStampStatusText, type StampProgressStatus } from "@/lib/gathering";

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

type RealtimeCallback = (payload: { new: Record<string, unknown> }) => void;

// Realtime の .on() に渡されたコールバックを保持し、テストから任意に発火できるようにする
const { getRealtimeCallback, setRealtimeCallback, resetRealtimeCallback } = vi.hoisted(() => {
  let cb: RealtimeCallback | null = null;
  return {
    getRealtimeCallback: () => cb,
    setRealtimeCallback: (fn: RealtimeCallback) => {
      cb = fn;
    },
    resetRealtimeCallback: () => {
      cb = null;
    },
  };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => {
      const chan = {
        on: (_event: string, _filter: unknown, callback: RealtimeCallback) => {
          setRealtimeCallback(callback);
          return chan;
        },
        subscribe: () => chan,
      };
      return chan;
    },
    removeChannel: vi.fn(),
  }),
}));

const SEEN_KEY = "gathering:seenStampIds";

const members = [
  { id: "me", monsterName: "ぼく", isMe: true },
  { id: "other-1", monsterName: "ピカ", isMe: false },
  { id: "other-2", monsterName: "ガル", isMe: false },
  { id: "other-3", monsterName: "モコ", isMe: false },
  { id: "other-4", monsterName: "ラン", isMe: false },
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

function questStatuses(status: StampProgressStatus): Array<{ status: string }> {
  switch (status) {
    case "NOT_STARTED":
      return [{ status: "PENDING" }, { status: "PENDING" }];
    case "IN_PROGRESS":
      return [{ status: "APPROVED" }, { status: "PENDING" }];
    case "DONE":
      return [{ status: "APPROVED" }, { status: "APPROVED" }];
  }
}

function stampEvent(id: string, senderId: string): { new: Record<string, unknown> } {
  return { new: { id, groupId: "g-1", senderId, date: "2026-01-01" } };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  resetRealtimeCallback();
});

afterEach(() => {
  localStorage.clear();
});

describe("GatheringStampPanel — エール受信モーダル", () => {
  it("エールを1件受信すると全画面モーダルが表示され、送信者名込みの本文になる", async () => {
    setupFetch({
      "/api/gathering/stamp/today": () => ({ sentToday: false }),
      "/api/gathering/stamps/received-today": () => ({
        stamps: [{ id: "s-1", senderId: "other-1", senderName: "ピカ" }],
      }),
      "/api/quests/today": () => questStatuses("IN_PROGRESS"),
    });

    render(<GatheringStampPanel groupId="g-1" members={members} />);

    await waitFor(() => {
      expect(screen.getByText("エールが届いた！")).toBeTruthy();
    });
    expect(
      screen.getByText(buildStampMessage("ピカ", "IN_PROGRESS")),
    ).toBeTruthy();
  });

  it("エールを複数件（3人以内）受信すると人数分の名前を連結した subtitle を表示し、description に名前を含めない", async () => {
    setupFetch({
      "/api/gathering/stamp/today": () => ({ sentToday: false }),
      "/api/gathering/stamps/received-today": () => ({
        stamps: [
          { id: "s-1", senderId: "other-1", senderName: "ピカ" },
          { id: "s-2", senderId: "other-2", senderName: "ガル" },
          { id: "s-3", senderId: "other-3", senderName: "モコ" },
        ],
      }),
      "/api/quests/today": () => questStatuses("DONE"),
    });

    render(<GatheringStampPanel groupId="g-1" members={members} />);

    await waitFor(() => {
      expect(screen.getByText("エールが届いた！")).toBeTruthy();
    });

    // description は名前を含まない共通ステータス文言のみ
    expect(screen.getByText(getStampStatusText("DONE"))).toBeTruthy();
    // subtitle には3人分の名前がすべて含まれる（3人以内は「ほかN人」を付けない）
    const subtitle = screen.getByText(/からエール！$/);
    expect(subtitle.textContent).toContain("ピカ");
    expect(subtitle.textContent).toContain("ガル");
    expect(subtitle.textContent).toContain("モコ");
    expect(subtitle.textContent).not.toMatch(/ほか\d+人/);
  });

  it("エールを4人から受信すると3人まで名前を表示し「ほか1人」と集約する", async () => {
    setupFetch({
      "/api/gathering/stamp/today": () => ({ sentToday: false }),
      "/api/gathering/stamps/received-today": () => ({
        stamps: [
          { id: "s-1", senderId: "other-1", senderName: "ピカ" },
          { id: "s-2", senderId: "other-2", senderName: "ガル" },
          { id: "s-3", senderId: "other-3", senderName: "モコ" },
          { id: "s-4", senderId: "other-4", senderName: "ラン" },
        ],
      }),
      "/api/quests/today": () => questStatuses("NOT_STARTED"),
    });

    render(<GatheringStampPanel groupId="g-1" members={members} />);

    await waitFor(() => {
      expect(screen.getByText("エールが届いた！")).toBeTruthy();
    });

    const subtitle = screen.getByText(/からエール！$/);
    expect(subtitle.textContent).toMatch(/ほか1人/);
    // description には名前を含めない
    expect(screen.getByText(getStampStatusText("NOT_STARTED"))).toBeTruthy();
  });

  it("表示中に Realtime で追加受信すると同じモーダルが更新される（タイトルが重複しない）", async () => {
    setupFetch({
      "/api/gathering/stamp/today": () => ({ sentToday: false }),
      "/api/gathering/stamps/received-today": () => ({
        stamps: [{ id: "s-1", senderId: "other-1", senderName: "ピカ" }],
      }),
      "/api/quests/today": () => questStatuses("IN_PROGRESS"),
    });

    render(<GatheringStampPanel groupId="g-1" members={members} />);

    await waitFor(() => {
      expect(screen.getByText("エールが届いた！")).toBeTruthy();
    });

    await act(async () => {
      getRealtimeCallback()?.(stampEvent("s-2", "other-2"));
      await Promise.resolve();
    });

    await waitFor(() => {
      const subtitle = screen.getByText(/からエール！$/);
      expect(subtitle.textContent).toContain("ピカ");
      expect(subtitle.textContent).toContain("ガル");
    });
    // 別モーダルが積み重なっていない（タイトルは常に1つ）
    expect(screen.getAllByText("エールが届いた！").length).toBe(1);
  });

  it("タップでクローズすると非表示になる", async () => {
    setupFetch({
      "/api/gathering/stamp/today": () => ({ sentToday: false }),
      "/api/gathering/stamps/received-today": () => ({
        stamps: [{ id: "s-1", senderId: "other-1", senderName: "ピカ" }],
      }),
      "/api/quests/today": () => questStatuses("IN_PROGRESS"),
    });

    render(<GatheringStampPanel groupId="g-1" members={members} />);

    await waitFor(() => {
      expect(screen.getByText("エールが届いた！")).toBeTruthy();
    });

    fireEvent.click(screen.getByText("エールが届いた！"));

    await waitFor(() => {
      expect(screen.queryByText("エールが届いた！")).toBeNull();
    });
  });

  it("クローズ後に新規受信すれば再度モーダルが表示される", async () => {
    setupFetch({
      "/api/gathering/stamp/today": () => ({ sentToday: false }),
      "/api/gathering/stamps/received-today": () => ({
        stamps: [{ id: "s-1", senderId: "other-1", senderName: "ピカ" }],
      }),
      "/api/quests/today": () => questStatuses("IN_PROGRESS"),
    });

    render(<GatheringStampPanel groupId="g-1" members={members} />);

    await waitFor(() => {
      expect(screen.getByText("エールが届いた！")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("エールが届いた！"));
    await waitFor(() => {
      expect(screen.queryByText("エールが届いた！")).toBeNull();
    });

    await act(async () => {
      getRealtimeCallback()?.(stampEvent("s-2", "other-2"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("エールが届いた！")).toBeTruthy();
    });
    expect(
      screen.getByText(buildStampMessage("ガル", "IN_PROGRESS")),
    ).toBeTruthy();
  });

  it("マウント取得と Realtime で同じ ID が来ても1件のみ表示される（重複排除）", async () => {
    setupFetch({
      "/api/gathering/stamp/today": () => ({ sentToday: false }),
      "/api/gathering/stamps/received-today": () => ({
        stamps: [{ id: "s-1", senderId: "other-1", senderName: "ピカ" }],
      }),
      "/api/quests/today": () => questStatuses("IN_PROGRESS"),
    });

    render(<GatheringStampPanel groupId="g-1" members={members} />);

    // マウント時の再生 useEffect が完了しないうちに、同じ ID の Realtime イベントを発火させる
    act(() => {
      getRealtimeCallback()?.(stampEvent("s-1", "other-1"));
    });

    await waitFor(() => {
      expect(screen.getByText("エールが届いた！")).toBeTruthy();
    });

    // 1件のみなら description は buildStampMessage(単一名) 形式のまま（subtitle の「複数名」形式にならない）
    expect(
      screen.getByText(buildStampMessage("ピカ", "IN_PROGRESS")),
    ).toBeTruthy();
    expect(screen.queryByText(/からエール！$/)).toBeNull();
  });

  it("既読済み（seenStampIds にある）ID はモーダル表示されない", async () => {
    localStorage.setItem(SEEN_KEY, JSON.stringify(["s-1"]));
    setupFetch({
      "/api/gathering/stamp/today": () => ({ sentToday: false }),
      "/api/gathering/stamps/received-today": () => ({
        stamps: [{ id: "s-1", senderId: "other-1", senderName: "ピカ" }],
      }),
      "/api/quests/today": () => questStatuses("IN_PROGRESS"),
    });

    render(<GatheringStampPanel groupId="g-1" members={members} />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(screen.queryByText("エールが届いた！")).toBeNull();
  });

  it("受信が1件もなければモーダルは出ない", async () => {
    setupFetch({
      "/api/gathering/stamp/today": () => ({ sentToday: false }),
      "/api/gathering/stamps/received-today": () => ({ stamps: [] }),
      "/api/quests/today": () => [],
    });

    render(<GatheringStampPanel groupId="g-1" members={members} />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(screen.queryByText("エールが届いた！")).toBeNull();
  });

  it("進捗API（/api/quests/today）が未解決の間に同一IDのイベントが重複発火しても1件のみ処理される", async () => {
    let resolveQuests: (value: Array<{ status: string }>) => void = () => {};
    const questsPromise = new Promise<Array<{ status: string }>>((resolve) => {
      resolveQuests = resolve;
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.includes("/api/gathering/stamp/today")) {
        return { ok: true, status: 200, json: async () => ({ sentToday: false }) } as Response;
      }
      if (url.includes("/api/gathering/stamps/received-today")) {
        return { ok: true, status: 200, json: async () => ({ stamps: [] }) } as Response;
      }
      if (url.includes("/api/quests/today")) {
        const body = await questsPromise;
        return { ok: true, status: 200, json: async () => body } as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as Response;
    }) as typeof fetch;

    render(<GatheringStampPanel groupId="g-1" members={members} />);

    await waitFor(() => expect(getRealtimeCallback()).not.toBeNull());

    // 同一 ID のイベントを、進捗APIが解決する前に2回連続で発火させる（レース状態を再現）
    act(() => {
      getRealtimeCallback()?.(stampEvent("s-9", "other-1"));
    });
    act(() => {
      getRealtimeCallback()?.(stampEvent("s-9", "other-1"));
    });

    resolveQuests(questStatuses("NOT_STARTED"));

    await waitFor(() => {
      expect(screen.getByText("エールが届いた！")).toBeTruthy();
    });

    // 1件のみ処理されていれば単一名の description のまま（複数名の subtitle にならない）
    expect(
      screen.getByText(buildStampMessage("ピカ", "NOT_STARTED")),
    ).toBeTruthy();
    expect(screen.queryByText(/からエール！$/)).toBeNull();
  });
});
