// 子供画面の Realtime 購読を「自分の行だけ」に絞る（Supabase Realtime の RLS 評価・配信を減らす）。
import { beforeEach, describe, expect, it, vi } from "vitest";

type Registered = { channel: string; filter: { table: string; filter?: string } };
let registered: Registered[] = [];
let removeChannel = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: (name: string) => {
      const channel = {
        on: vi.fn((_t: string, filter: Registered["filter"]) => {
          registered.push({ channel: name, filter });
          return channel;
        }),
        subscribe: vi.fn(() => channel),
      };
      return channel;
    },
    removeChannel: (...args: unknown[]) => removeChannel(...args),
  }),
}));

async function loadModule() {
  vi.resetModules();
  return import("@/lib/childRealtime");
}

const flush = () => new Promise((r) => setTimeout(r, 0));

function okResponse(body: unknown) {
  const res = { ok: true, status: 200, json: () => Promise.resolve(body), clone: () => res };
  return res;
}

beforeEach(() => {
  registered = [];
  removeChannel = vi.fn();
});

describe("childRealtime のフィルタ", () => {
  it("/api/users/me で自分の ID が分かったら、自分の行だけを購読するチャンネルに張り替える", async () => {
    global.fetch = vi.fn().mockResolvedValue(okResponse({ id: "child-1" })) as unknown as typeof fetch;
    const { subscribeChildRealtime } = await loadModule();

    const off = subscribeChildRealtime("QuestInstance", vi.fn());
    await flush();
    await flush();

    const channels = [...new Set(registered.map((r) => r.channel))];
    expect(channels).toHaveLength(2);
    expect(removeChannel).toHaveBeenCalledTimes(1);
    const latest = registered.filter((r) => r.channel === channels[1]);
    expect(Object.fromEntries(latest.map((r) => [r.filter.table, r.filter.filter]))).toEqual({
      User: "id=eq.child-1",
      UserBadge: "userId=eq.child-1",
      QuestInstance: "childId=eq.child-1",
      TreasureLog: "childId=eq.child-1",
    });
    off();
  });

  it("ID が分かった後に開くチャンネルは最初からフィルタ付きで、再取得もしない", async () => {
    global.fetch = vi.fn().mockResolvedValue(okResponse({ id: "child-1" })) as unknown as typeof fetch;
    const { subscribeChildRealtime } = await loadModule();
    const off1 = subscribeChildRealtime("QuestInstance", vi.fn());
    await flush();
    await flush();
    off1();
    registered = [];

    const off2 = subscribeChildRealtime("User", vi.fn());

    expect(registered.length).toBeGreaterThan(0);
    expect(registered.every((r) => typeof r.filter.filter === "string")).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    off2();
  });

  it("ID の取得に失敗したらフィルタなしのまま購読を続ける", async () => {
    const res = { ok: false, status: 401, json: () => Promise.resolve({}), clone: () => res };
    global.fetch = vi.fn().mockResolvedValue(res) as unknown as typeof fetch;
    const { subscribeChildRealtime } = await loadModule();

    const off = subscribeChildRealtime("QuestInstance", vi.fn());
    await flush();
    await flush();

    expect(new Set(registered.map((r) => r.channel)).size).toBe(1);
    expect(removeChannel).not.toHaveBeenCalled();
    off();
  });

  it("ID 取得前に全リスナーが解除されたら、チャンネルを開き直さない", async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    global.fetch = vi.fn().mockReturnValue(
      new Promise((r) => {
        resolveFetch = r;
      }),
    ) as unknown as typeof fetch;
    const { subscribeChildRealtime } = await loadModule();

    const off = subscribeChildRealtime("QuestInstance", vi.fn());
    off();
    resolveFetch(okResponse({ id: "child-1" }));
    await flush();
    await flush();

    expect(new Set(registered.map((r) => r.channel)).size).toBe(1);
  });
});
