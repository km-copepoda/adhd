// 親画面の Realtime 購読を「自分の家族の子供の行」に絞る。
import { beforeEach, describe, expect, it, vi } from "vitest";

type Registered = { channel: string; filter: { table: string; event: string; filter?: string } };
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

import { subscribeFamilyRealtime, notifyFamilyMembersChanged } from "@/lib/parentRealtime";
import { invalidateDeduped } from "@/lib/fetchDeduped";

const flush = () => new Promise((r) => setTimeout(r, 0));

function mockFamily(ok: boolean, members: { id: string; role: string }[] = []) {
  const res = {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve({ code: "ABC", members }),
    clone: () => res,
  };
  global.fetch = vi.fn().mockResolvedValue(res) as unknown as typeof fetch;
}

beforeEach(() => {
  registered = [];
  removeChannel = vi.fn();
  invalidateDeduped();
});

describe("subscribeFamilyRealtime", () => {
  it("家族の子供 ID で絞り込んだ購読を登録する（親は対象外）", async () => {
    mockFamily(true, [
      { id: "p1", role: "PARENT" },
      { id: "c1", role: "CHILD" },
      { id: "c2", role: "CHILD" },
    ]);

    const off = subscribeFamilyRealtime("pending", ["QuestInstance", "TaskTemplate", "TreasureLog"], vi.fn());
    await flush();
    await flush();

    expect(Object.fromEntries(registered.map((r) => [r.filter.table, r.filter.filter]))).toEqual({
      QuestInstance: "childId=in.(c1,c2)",
      TaskTemplate: "assignedChildId=in.(c1,c2)",
      TreasureLog: "childId=in.(c1,c2)",
    });
    expect(registered.every((r) => r.filter.event === "*")).toBe(true);
    off();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it("子供がいない家族では購読しない", async () => {
    mockFamily(true, [{ id: "p1", role: "PARENT" }]);

    const off = subscribeFamilyRealtime("pending", ["QuestInstance"], vi.fn());
    await flush();
    await flush();

    expect(registered).toHaveLength(0);
    off();
    expect(removeChannel).not.toHaveBeenCalled();
  });

  it("子供一覧の取得に失敗したらフィルタなしで購読する（従来どおりの動作を保つ）", async () => {
    mockFamily(false);

    const off = subscribeFamilyRealtime("pending", ["QuestInstance", "TreasureLog"], vi.fn());
    await flush();
    await flush();

    expect(registered.map((r) => r.filter.table).sort()).toEqual(["QuestInstance", "TreasureLog"]);
    expect(registered.every((r) => r.filter.filter === undefined)).toBe(true);
    off();
  });

  it("子供一覧の取得前に解除されたら購読しない", async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    global.fetch = vi.fn().mockReturnValue(
      new Promise((r) => {
        resolveFetch = r;
      }),
    ) as unknown as typeof fetch;

    const off = subscribeFamilyRealtime("pending", ["QuestInstance"], vi.fn());
    off();
    const res = {
      ok: true,
      json: () => Promise.resolve({ members: [{ id: "c1", role: "CHILD" }] }),
      clone: () => res,
    };
    resolveFetch(res);
    await flush();
    await flush();

    expect(registered).toHaveLength(0);
  });

  it("子供0人で始めても、子供を追加したら（notifyFamilyMembersChanged）購読が始まる", async () => {
    mockFamily(true, [{ id: "p1", role: "PARENT" }]);
    const off = subscribeFamilyRealtime("pending", ["QuestInstance"], vi.fn());
    await flush();
    await flush();
    expect(registered).toHaveLength(0);

    mockFamily(true, [
      { id: "p1", role: "PARENT" },
      { id: "c1", role: "CHILD" },
    ]);
    notifyFamilyMembersChanged();
    await flush();
    await flush();

    expect(registered.map((r) => r.filter.filter)).toEqual(["childId=in.(c1)"]);
    off();
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });

  it("子供が増えたら、古い購読を閉じて新しい子供一覧で張り直す", async () => {
    mockFamily(true, [{ id: "c1", role: "CHILD" }]);
    const off = subscribeFamilyRealtime("pending", ["QuestInstance"], vi.fn());
    await flush();
    await flush();

    mockFamily(true, [
      { id: "c1", role: "CHILD" },
      { id: "c2", role: "CHILD" },
    ]);
    notifyFamilyMembersChanged();
    await flush();
    await flush();

    expect(removeChannel).toHaveBeenCalledTimes(1);
    expect(registered.map((r) => r.filter.filter)).toEqual(["childId=in.(c1)", "childId=in.(c1,c2)"]);
    off();
  });

  it("解除済みの購読は、家族構成が変わっても張り直さない", async () => {
    mockFamily(true, [{ id: "c1", role: "CHILD" }]);
    const off = subscribeFamilyRealtime("pending", ["QuestInstance"], vi.fn());
    await flush();
    await flush();
    off();
    registered = [];

    notifyFamilyMembersChanged();
    await flush();
    await flush();

    expect(registered).toHaveLength(0);
  });

  it("家族構成が変わったら onChange も呼んで再取得させる（子供削除の DELETE はフィルタ付き購読に届かないため）", async () => {
    mockFamily(true, [{ id: "c1", role: "CHILD" }]);
    const onChange = vi.fn();
    const off = subscribeFamilyRealtime("pending", ["QuestInstance"], onChange);
    await flush();
    await flush();
    expect(onChange).not.toHaveBeenCalled();

    mockFamily(true, []);
    notifyFamilyMembersChanged();
    await flush();
    await flush();

    expect(onChange).toHaveBeenCalledTimes(1);
    off();
  });
});

