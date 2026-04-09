import { onApprovalsUpdated, notifyApprovalsUpdated } from "@/lib/approval-events";

describe("approval-events", () => {
  it("notifyApprovalsUpdated が登録済みリスナーを全て呼ぶ", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const unsub1 = onApprovalsUpdated(cb1);
    const unsub2 = onApprovalsUpdated(cb2);

    notifyApprovalsUpdated();

    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();

    unsub1();
    unsub2();
  });

  it("unsubscribe 後はリスナーが呼ばれない", () => {
    const cb = vi.fn();
    const unsub = onApprovalsUpdated(cb);
    unsub();

    notifyApprovalsUpdated();

    expect(cb).not.toHaveBeenCalled();
  });

  it("複数回 notify しても都度リスナーが呼ばれる", () => {
    const cb = vi.fn();
    const unsub = onApprovalsUpdated(cb);

    notifyApprovalsUpdated();
    notifyApprovalsUpdated();

    expect(cb).toHaveBeenCalledTimes(2);

    unsub();
  });
});
