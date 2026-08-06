import { describe, it, expect } from "vitest";
import {
  LIMITS,
  computeLimit,
  isPlanActive,
  resolvePlan,
  checkLimit,
  checkBulkLimit,
} from "@/lib/subscription";

describe("LIMITS 定数", () => {
  it("FREE: child=1 / task=10 / treasure_item=5", () => {
    expect(LIMITS.FREE.child).toBe(1);
    expect(LIMITS.FREE.task).toBe(10);
    expect(LIMITS.FREE.treasure_item).toBe(5);
  });

  it("PREMIUM: 全リソースが null (無制限)", () => {
    expect(LIMITS.PREMIUM.child).toBeNull();
    expect(LIMITS.PREMIUM.task).toBeNull();
    expect(LIMITS.PREMIUM.treasure_item).toBeNull();
  });
});

describe("computeLimit", () => {
  it("FREE の各リソース上限を返す", () => {
    expect(computeLimit("FREE", "child")).toBe(1);
    expect(computeLimit("FREE", "task")).toBe(10);
    expect(computeLimit("FREE", "treasure_item")).toBe(5);
  });

  it("PREMIUM は null (無制限)", () => {
    expect(computeLimit("PREMIUM", "child")).toBeNull();
    expect(computeLimit("PREMIUM", "task")).toBeNull();
    expect(computeLimit("PREMIUM", "treasure_item")).toBeNull();
  });
});

describe("isPlanActive", () => {
  const now = new Date("2026-08-06T00:00:00Z");

  it("null (未登録) は false", () => {
    expect(isPlanActive(null, now)).toBe(false);
  });

  it("plan=FREE は currentPeriodEnd に関わらず false", () => {
    expect(
      isPlanActive({ plan: "FREE", currentPeriodEnd: null }, now),
    ).toBe(false);
    expect(
      isPlanActive(
        { plan: "FREE", currentPeriodEnd: new Date("2026-12-31") },
        now,
      ),
    ).toBe(false);
  });

  it("plan=PREMIUM + currentPeriodEnd=null は true (期間無期限扱い)", () => {
    expect(
      isPlanActive({ plan: "PREMIUM", currentPeriodEnd: null }, now),
    ).toBe(true);
  });

  it("plan=PREMIUM + currentPeriodEnd が未来 は true", () => {
    expect(
      isPlanActive(
        { plan: "PREMIUM", currentPeriodEnd: new Date("2026-09-06") },
        now,
      ),
    ).toBe(true);
  });

  it("plan=PREMIUM + currentPeriodEnd が過去 は false", () => {
    expect(
      isPlanActive(
        { plan: "PREMIUM", currentPeriodEnd: new Date("2026-07-01") },
        now,
      ),
    ).toBe(false);
  });

  it("境界値: currentPeriodEnd === now は false (含まない)", () => {
    expect(
      isPlanActive({ plan: "PREMIUM", currentPeriodEnd: now }, now),
    ).toBe(false);
  });

  it("境界値: currentPeriodEnd が now より 1ms 後は true", () => {
    const oneMsLater = new Date(now.getTime() + 1);
    expect(
      isPlanActive(
        { plan: "PREMIUM", currentPeriodEnd: oneMsLater },
        now,
      ),
    ).toBe(true);
  });
});

describe("resolvePlan", () => {
  const now = new Date("2026-08-06T00:00:00Z");

  it("null は FREE", () => {
    expect(resolvePlan(null, now)).toBe("FREE");
  });

  it("plan=FREE は FREE", () => {
    expect(
      resolvePlan({ plan: "FREE", currentPeriodEnd: null }, now),
    ).toBe("FREE");
  });

  it("plan=PREMIUM でアクティブ期間内は PREMIUM", () => {
    expect(
      resolvePlan(
        { plan: "PREMIUM", currentPeriodEnd: new Date("2026-09-06") },
        now,
      ),
    ).toBe("PREMIUM");
  });

  it("plan=PREMIUM で期間切れは FREE", () => {
    expect(
      resolvePlan(
        { plan: "PREMIUM", currentPeriodEnd: new Date("2026-07-01") },
        now,
      ),
    ).toBe("FREE");
  });
});

describe("checkLimit", () => {
  it("FREE child: 0/1 は allowed=true", () => {
    const r = checkLimit("FREE", "child", 0);
    expect(r.allowed).toBe(true);
    expect(r.current).toBe(0);
    expect(r.limit).toBe(1);
  });

  it("FREE child: 1/1 (上限ちょうど) は allowed=false (追加不可)", () => {
    const r = checkLimit("FREE", "child", 1);
    expect(r.allowed).toBe(false);
    expect(r.current).toBe(1);
    expect(r.limit).toBe(1);
  });

  it("FREE child: 2/1 (超過) は allowed=false", () => {
    const r = checkLimit("FREE", "child", 2);
    expect(r.allowed).toBe(false);
  });

  it("FREE task: 9/10 は allowed=true (境界の1つ手前)", () => {
    const r = checkLimit("FREE", "task", 9);
    expect(r.allowed).toBe(true);
    expect(r.limit).toBe(10);
  });

  it("FREE task: 10/10 は allowed=false (境界ちょうどで追加不可)", () => {
    const r = checkLimit("FREE", "task", 10);
    expect(r.allowed).toBe(false);
  });

  it("FREE treasure_item: 4/5 は allowed=true / 5/5 は allowed=false", () => {
    expect(checkLimit("FREE", "treasure_item", 4).allowed).toBe(true);
    expect(checkLimit("FREE", "treasure_item", 5).allowed).toBe(false);
  });

  it("PREMIUM は current がどれだけ大きくても allowed=true", () => {
    const r = checkLimit("PREMIUM", "task", 9999);
    expect(r.allowed).toBe(true);
    expect(r.limit).toBeNull();
    expect(r.current).toBe(9999);
  });
});

describe("checkBulkLimit", () => {
  it("FREE treasure_item: 0 に 5 追加は allowed=true (境界ちょうど)", () => {
    const r = checkBulkLimit("FREE", "treasure_item", 0, 5);
    expect(r.allowed).toBe(true);
    expect(r.limit).toBe(5);
  });

  it("FREE treasure_item: 0 に 6 追加は allowed=false (1 超過)", () => {
    const r = checkBulkLimit("FREE", "treasure_item", 0, 6);
    expect(r.allowed).toBe(false);
  });

  it("FREE treasure_item: 3 に 3 追加は allowed=false (合計 6, 上限 5)", () => {
    const r = checkBulkLimit("FREE", "treasure_item", 3, 3);
    expect(r.allowed).toBe(false);
  });

  it("FREE treasure_item: 3 に 2 追加は allowed=true (合計 5, 上限ちょうど)", () => {
    const r = checkBulkLimit("FREE", "treasure_item", 3, 2);
    expect(r.allowed).toBe(true);
  });

  it("PREMIUM は addCount がどれだけ大きくても allowed=true", () => {
    const r = checkBulkLimit("PREMIUM", "treasure_item", 100, 1000);
    expect(r.allowed).toBe(true);
    expect(r.limit).toBeNull();
  });

  it("addCount=1 は checkLimit と等価", () => {
    // FREE task: 9/10 → 追加可
    expect(checkBulkLimit("FREE", "task", 9, 1).allowed).toBe(true);
    // FREE task: 10/10 → 追加不可
    expect(checkBulkLimit("FREE", "task", 10, 1).allowed).toBe(false);
  });
});
