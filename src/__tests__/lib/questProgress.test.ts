import { describe, it, expect } from "vitest";
import { computeQuestSuccessDisplay, computeCompletedCount, computeRemainingCount } from "@/lib/questProgress";

describe("computeQuestSuccessDisplay", () => {
  it("completed が 1、total が 1 のとき allDone になる（2/1 にならない）", () => {
    // refreshQuests() 後に completedCount が既に 1 に更新されている状態
    const result = computeQuestSuccessDisplay(1, 1);
    expect(result.completed).toBe(1);
    expect(result.remaining).toBe(0);
    expect(result.allDone).toBe(true);
  });

  it("completed が 1、total が 3 のとき残り 2 になる", () => {
    const result = computeQuestSuccessDisplay(1, 3);
    expect(result.completed).toBe(1);
    expect(result.remaining).toBe(2);
    expect(result.allDone).toBe(false);
  });

  it("completed が 0、total が 0 のとき allDone にならない（表示なし想定）", () => {
    const result = computeQuestSuccessDisplay(0, 0);
    expect(result.remaining).toBe(0);
    expect(result.allDone).toBe(true);
  });

  it("completed が total を超えない（防御: 旧バグ + 1 相当を渡しても壊れない）", () => {
    // もし呼び出し元が誤って +1 した値を渡しても remaining が負にならないこと
    const result = computeQuestSuccessDisplay(2, 1);
    expect(result.remaining).toBe(-1); // 負になる = バグとして検出可能
    expect(result.allDone).toBe(true);
  });
});

describe("computeCompletedCount", () => {
  const q = (status: string) => ({ status });

  it("REPORTED と APPROVED をカウントする", () => {
    const quests = [q("REPORTED"), q("APPROVED"), q("PENDING")];
    expect(computeCompletedCount(quests)).toBe(2);
  });

  it("SKIP_REPORTED をカウントする（親承認待ちスキップ）", () => {
    const quests = [q("APPROVED"), q("SKIP_REPORTED"), q("PENDING")];
    expect(computeCompletedCount(quests)).toBe(2);
  });

  it("SKIPPED をカウントする（親承認済みスキップ）", () => {
    const quests = [q("APPROVED"), q("SKIPPED"), q("PENDING")];
    expect(computeCompletedCount(quests)).toBe(2);
  });

  it("全クエストがスキップ/完了のとき total と一致する", () => {
    const quests = [q("APPROVED"), q("SKIPPED"), q("REPORTED"), q("SKIP_REPORTED")];
    expect(computeCompletedCount(quests)).toBe(4);
  });

  it("PENDING と REJECTED はカウントしない", () => {
    const quests = [q("PENDING"), q("REJECTED")];
    expect(computeCompletedCount(quests)).toBe(0);
  });

  it("空配列は 0", () => {
    expect(computeCompletedCount([])).toBe(0);
  });
});

describe("computeRemainingCount", () => {
  const q = (status: string) => ({ status });
  
  it("PENDING と REJECTED をカウントする", () => {
    const quests = [q("PENDING"), q("REJECTED"), q("APPROVED")];
    expect(computeRemainingCount(quests)).toBe(2);
  });

  it("REPORTED / APPROVED / SKIPPED / SKIP_REPORTED はカウントしない", () => {
    const quests = [q("REPORTED"), q("APPROVED"), q("SKIPPED"), q("SKIP_REPORTED")];
    expect(computeRemainingCount(quests)).toBe(0);
  });

  it("すべて PENDING のとき全数を返す", () => {
    const quests = [q("PENDING"), q("PENDING"), q("PENDING")];
    expect(computeRemainingCount(quests)).toBe(3);
  });
  
  it("空配列は 0", () => {
    expect(computeRemainingCount([])).toBe(0);
  });
  
  it("computeCompletedCount + computeRemainingCount = total になる", () => {
    const quests = [q("PENDING"), q("REPORTED"), q("APPROVED"), q("REJECTED"), q("SKIPPED"), q("SKIP_REPORTED")];
    expect(computeCompletedCount(quests) + computeRemainingCount(quests)).toBe(quests.length);
  });
});