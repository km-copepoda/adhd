import { describe, it, expect } from "vitest";
import {
  getTreasureCountdown,
  ALL_DONE_MESSAGES,
} from "@/lib/treasureCountdown";

describe("getTreasureCountdown", () => {
  it("totalCount=0 のときは none を返す（今日のタスクが無い）", () => {
    const r = getTreasureCountdown({ completedCount: 0, totalCount: 0, minTasks: 1 });
    expect(r.kind).toBe("none");
  });

  it("completedCount < minTasks のとき to_streak フェーズと残数を返す", () => {
    const r = getTreasureCountdown({ completedCount: 1, totalCount: 5, minTasks: 3 });
    expect(r.kind).toBe("to_streak");
    if (r.kind === "to_streak") {
      expect(r.remaining).toBe(2);
      expect(r.text).toContain("2");
      expect(r.text).toMatch(/宝箱/);
    }
  });

  it("completedCount=0 / minTasks=3 のとき残数3 で to_streak", () => {
    const r = getTreasureCountdown({ completedCount: 0, totalCount: 5, minTasks: 3 });
    expect(r.kind).toBe("to_streak");
    if (r.kind === "to_streak") expect(r.remaining).toBe(3);
  });

  it("minTasks に到達した瞬間（境界）に to_all_complete に切り替わる", () => {
    const r = getTreasureCountdown({ completedCount: 3, totalCount: 5, minTasks: 3 });
    expect(r.kind).toBe("to_all_complete");
    if (r.kind === "to_all_complete") {
      expect(r.remaining).toBe(2);
      // レア確率UP宝箱（ALL_COMPLETE は boosted: true）への期待を訴求する文言
      expect(r.text).toMatch(/レア|確率UP|キラキラ/);
    }
  });

  it("skippedCount>0 のとき to_all_complete はレア確率UPを訴求しない (普通の宝箱)", () => {
    const r = getTreasureCountdown({
      completedCount: 3,
      totalCount: 5,
      minTasks: 3,
      skippedCount: 1,
    });
    expect(r.kind).toBe("to_all_complete");
    if (r.kind === "to_all_complete") {
      expect(r.remaining).toBe(2);
      // スキップを含む日は ALL_COMPLETE が boosted=false なので「レア確率UP」を訴求しない
      expect(r.text).not.toMatch(/レア|確率UP|キラキラ/);
      expect(r.text).toMatch(/宝箱/);
    }
  });

  it("skippedCount=0 のときは従来どおりレア確率UP訴求", () => {
    const r = getTreasureCountdown({
      completedCount: 3,
      totalCount: 5,
      minTasks: 3,
      skippedCount: 0,
    });
    expect(r.kind).toBe("to_all_complete");
    if (r.kind === "to_all_complete") {
      expect(r.text).toMatch(/レア|確率UP|キラキラ/);
    }
  });

  it("minTasks 超過～全完了未満で to_all_complete", () => {
    const r = getTreasureCountdown({ completedCount: 4, totalCount: 5, minTasks: 3 });
    expect(r.kind).toBe("to_all_complete");
    if (r.kind === "to_all_complete") expect(r.remaining).toBe(1);
  });

  it("全完了（completedCount >= totalCount）で all_done を返す", () => {
    const r = getTreasureCountdown({ completedCount: 5, totalCount: 5, minTasks: 3 });
    expect(r.kind).toBe("all_done");
    if (r.kind === "all_done") {
      expect(r.text.length).toBeGreaterThan(0);
      expect(ALL_DONE_MESSAGES).toContain(r.text);
    }
  });

  it("all_done の messageIndex を指定するとそのメッセージを返す（決定的）", () => {
    const r = getTreasureCountdown({
      completedCount: 5,
      totalCount: 5,
      minTasks: 3,
      allDoneMessageIndex: 0,
    });
    expect(r.kind).toBe("all_done");
    if (r.kind === "all_done") {
      expect(r.text).toBe(ALL_DONE_MESSAGES[0]);
      expect(r.messageIndex).toBe(0);
    }
  });

  it("messageIndex が範囲外でも安全に折り返す", () => {
    const r = getTreasureCountdown({
      completedCount: 5,
      totalCount: 5,
      minTasks: 3,
      allDoneMessageIndex: ALL_DONE_MESSAGES.length + 3,
    });
    expect(r.kind).toBe("all_done");
    if (r.kind === "all_done") {
      expect(ALL_DONE_MESSAGES).toContain(r.text);
    }
  });

  it("messageIndex に負数を渡しても安全（絶対値で折り返し）", () => {
    const r = getTreasureCountdown({
      completedCount: 5,
      totalCount: 5,
      minTasks: 3,
      allDoneMessageIndex: -1,
    });
    expect(r.kind).toBe("all_done");
    if (r.kind === "all_done") {
      expect(ALL_DONE_MESSAGES).toContain(r.text);
    }
  });

  it("minTasks=1 / completedCount=0 → to_streak で残り1", () => {
    const r = getTreasureCountdown({ completedCount: 0, totalCount: 2, minTasks: 1 });
    expect(r.kind).toBe("to_streak");
    if (r.kind === "to_streak") expect(r.remaining).toBe(1);
  });

  it("minTasks > totalCount でも all_done へ到達できる（minTasks は totalCount にクランプ）", () => {
    // 親が minTasks=5 と設定したが今日のタスクは3個しかない場合
    // 全完了したら all_done になるべき（永久に to_streak で止まらない）
    const r = getTreasureCountdown({ completedCount: 3, totalCount: 3, minTasks: 5 });
    expect(r.kind).toBe("all_done");
  });

  it("minTasks > totalCount で全完了未満なら to_streak（totalCount まで届けば実質 all_done）", () => {
    // minTasks=5, total=3, completed=1 → あと2個 (totalCount-completed) で全完了 = 宝箱
    const r = getTreasureCountdown({ completedCount: 1, totalCount: 3, minTasks: 5 });
    // クランプ後 effectiveMinTasks=3、so to_streak で残り2
    expect(r.kind).toBe("to_streak");
    if (r.kind === "to_streak") expect(r.remaining).toBe(2);
  });

  it("completedCount > totalCount（異常値）でも all_done を返し落ちない", () => {
    const r = getTreasureCountdown({ completedCount: 10, totalCount: 5, minTasks: 3 });
    expect(r.kind).toBe("all_done");
  });
});

describe("ALL_DONE_MESSAGES", () => {
  it("10件前後のバリエーションを持つ", () => {
    expect(ALL_DONE_MESSAGES.length).toBeGreaterThanOrEqual(8);
  });

  it("全メッセージが空でない", () => {
    for (const msg of ALL_DONE_MESSAGES) {
      expect(msg.length).toBeGreaterThan(0);
    }
  });

  it("重複が無い", () => {
    const unique = new Set(ALL_DONE_MESSAGES);
    expect(unique.size).toBe(ALL_DONE_MESSAGES.length);
  });
});
