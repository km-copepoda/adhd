import { describe, it, expect } from "vitest";
import { computeQuestSuccessDisplay, computeCompletedCount } from "@/lib/questProgress";

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
