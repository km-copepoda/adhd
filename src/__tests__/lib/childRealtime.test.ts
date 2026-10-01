import { beforeEach, describe, expect, it, vi } from "vitest";

type Registered = {
  filter: { event: string; schema: string; table: string };
  cb: (payload: unknown) => void;
};

const registered: Registered[] = [];
const channelNames: string[] = [];
const removeChannel = vi.fn();
const subscribe = vi.fn();
const createClientMock = vi.fn();

function makeChannel(name: string) {
  channelNames.push(name);
  const channel = {
    on: vi.fn((_type: string, filter: Registered["filter"], cb: Registered["cb"]) => {
      registered.push({ filter, cb });
      return channel;
    }),
    subscribe: vi.fn(() => {
      subscribe();
      return channel;
    }),
  };
  return channel;
}

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => {
    createClientMock();
    return {
      channel: (name: string) => makeChannel(name),
      removeChannel,
    };
  },
}));

import { subscribeChildRealtime } from "@/lib/childRealtime";
import { fetchDeduped } from "@/lib/fetchDeduped";

function emit(table: string, payload: unknown = {}) {
  for (const r of registered.filter((x) => x.filter.table === table)) r.cb(payload);
}

describe("subscribeChildRealtime", () => {
  beforeEach(() => {
    registered.length = 0;
    channelNames.length = 0;
    removeChannel.mockReset();
    subscribe.mockReset();
    createClientMock.mockReset();
  });

  it("最初の購読でチャンネルを1本だけ作り、4テーブル分の postgres_changes を登録する", () => {
    const off = subscribeChildRealtime("QuestInstance", vi.fn());

    expect(channelNames).toHaveLength(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
    const tables = registered.map((r) => `${r.filter.table}:${r.filter.event}`).sort();
    expect(tables).toEqual([
      "QuestInstance:*",
      "TreasureLog:*",
      "User:UPDATE",
      "UserBadge:INSERT",
    ]);
    off();
  });

  it("複数のリスナーを登録してもチャンネル・クライアントは1つだけ共有する", () => {
    const offs = [
      subscribeChildRealtime("QuestInstance", vi.fn()),
      subscribeChildRealtime("User", vi.fn()),
      subscribeChildRealtime("TreasureLog", vi.fn()),
      subscribeChildRealtime("UserBadge", vi.fn()),
    ];

    expect(channelNames).toHaveLength(1);
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
    offs.forEach((off) => off());
  });

  it("イベントは該当テーブルのリスナーにだけ届く", () => {
    const quest = vi.fn();
    const user = vi.fn();
    const offQuest = subscribeChildRealtime("QuestInstance", quest);
    const offUser = subscribeChildRealtime("User", user);

    emit("QuestInstance", { id: 1 });

    expect(quest).toHaveBeenCalledTimes(1);
    expect(quest).toHaveBeenCalledWith({ id: 1 });
    expect(user).not.toHaveBeenCalled();
    offQuest();
    offUser();
  });

  it("同じテーブルの複数リスナー全員にイベントが届く", () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeChildRealtime("QuestInstance", a);
    const offB = subscribeChildRealtime("QuestInstance", b);

    emit("QuestInstance");

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    offB();
  });

  it("同じ関数を2回登録しても、それぞれ独立に解除できる", () => {
    const fn = vi.fn();
    const off1 = subscribeChildRealtime("User", fn);
    const off2 = subscribeChildRealtime("User", fn);

    off1();
    emit("User");
    expect(fn).toHaveBeenCalledTimes(1);
    off2();
  });

  it("一部のリスナーを解除してもチャンネルは残り、残りのリスナーには届く", () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = subscribeChildRealtime("QuestInstance", a);
    const offB = subscribeChildRealtime("QuestInstance", b);

    offA();
    expect(removeChannel).not.toHaveBeenCalled();
    emit("QuestInstance");

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
    offB();
  });

  it("最後のリスナーを解除したらチャンネルを破棄する", () => {
    const offA = subscribeChildRealtime("QuestInstance", vi.fn());
    const offB = subscribeChildRealtime("User", vi.fn());

    offA();
    expect(removeChannel).not.toHaveBeenCalled();
    offB();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it("全解除後に再購読すると新しいチャンネルを作り直す", () => {
    subscribeChildRealtime("QuestInstance", vi.fn())();
    expect(channelNames).toHaveLength(1);

    const fn = vi.fn();
    const off = subscribeChildRealtime("QuestInstance", fn);
    expect(channelNames).toHaveLength(2);
    expect(subscribe).toHaveBeenCalledTimes(2);

    // 旧チャンネルに登録された古い callback ではなく、新しい callback 経由で届く
    const latest = registered.filter((r) => r.filter.table === "QuestInstance").at(-1)!;
    latest.cb({});
    expect(fn).toHaveBeenCalledTimes(1);
    off();
  });

  it("解除関数を二重に呼んでも安全（チャンネルを二重に破棄しない）", () => {
    const off = subscribeChildRealtime("User", vi.fn());
    off();
    off();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it("あるリスナーが例外を投げても、他のリスナーには届く", () => {
    const bad = vi.fn(() => {
      throw new Error("boom");
    });
    const good = vi.fn();
    const offBad = subscribeChildRealtime("QuestInstance", bad);
    const offGood = subscribeChildRealtime("QuestInstance", good);

    expect(() => emit("QuestInstance")).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
    offBad();
    offGood();
  });
  it("イベント到着時に進行中の fetch を無効化し、リスナーの再取得は古いリクエストに相乗りしない", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    try {
      let resolveOld!: (r: Response) => void;
      fetchMock
        .mockReturnValueOnce(new Promise<Response>((r) => (resolveOld = r)))
        .mockImplementation(async () => new Response(JSON.stringify({ v: "new" })));

      // イベント前に始まった（読み取りが更新前だったかもしれない）進行中リクエスト
      const oldCall = fetchDeduped("/api/quests/today");

      const results: unknown[] = [];
      const offA = subscribeChildRealtime("QuestInstance", async () => {
        results.push(await (await fetchDeduped("/api/quests/today")).json());
      });
      const offB = subscribeChildRealtime("QuestInstance", async () => {
        results.push(await (await fetchDeduped("/api/quests/today")).json());
      });

      emit("QuestInstance");
      // 同じイベントを受けた2つのリスナーは、新しい1本の fetch を共有する（古い fetch + 新しい1本 = 計2回）
      expect(fetchMock).toHaveBeenCalledTimes(2);
      await vi.waitFor(() => expect(results).toHaveLength(2));
      expect(results).toEqual([{ v: "new" }, { v: "new" }]);

      resolveOld(new Response(JSON.stringify({ v: "old" })));
      await oldCall;
      offA();
      offB();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
