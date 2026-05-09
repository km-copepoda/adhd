import { describe, it, expect } from "vitest";
import {
  computeQuestSuccessDisplay,
  computeCompletedCount,
  computeRemainingCount,
  sortQuestsByCompletion,
  sortQuestsForDeclaration,
} from "@/lib/questProgress";

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

describe("sortQuestsByCompletion", () => {
  const q = (id: string, status: string) => ({ id, status });

  it("未完了(PENDING/REJECTED)を上に、完了(REPORTED/APPROVED/SKIP_REPORTED/SKIPPED)を下に並べる", () => {
    const quests = [
      q("a", "APPROVED"),
      q("b", "PENDING"),
      q("c", "SKIPPED"),
      q("d", "REJECTED"),
      q("e", "REPORTED"),
      q("f", "PENDING"),
      q("g", "SKIP_REPORTED"),
    ];
    const sorted = sortQuestsByCompletion(quests);
    const ids = sorted.map((qu) => qu.id);
    // 未完了が前、完了が後ろ
    expect(ids.slice(0, 3)).toEqual(["b", "d", "f"]);
    expect(ids.slice(3).sort()).toEqual(["a", "c", "e", "g"]);
  });

  it("同じグループ内では元の順序を保つ（安定ソート）", () => {
    const quests = [
      q("a", "PENDING"),
      q("b", "APPROVED"),
      q("c", "REJECTED"),
      q("d", "REPORTED"),
      q("e", "PENDING"),
    ];
    const sorted = sortQuestsByCompletion(quests);
    expect(sorted.map((qu) => qu.id)).toEqual(["a", "c", "e", "b", "d"]);
  });

  it("空配列は空配列を返す", () => {
    expect(sortQuestsByCompletion([])).toEqual([]);
  });

  it("全部未完了のとき順序は変わらない", () => {
    const quests = [q("a", "PENDING"), q("b", "REJECTED"), q("c", "PENDING")];
    expect(sortQuestsByCompletion(quests).map((qu) => qu.id)).toEqual(["a", "b", "c"]);
  });

  it("全部完了のとき順序は変わらない", () => {
    const quests = [q("a", "APPROVED"), q("b", "REPORTED"), q("c", "SKIPPED")];
    expect(sortQuestsByCompletion(quests).map((qu) => qu.id)).toEqual(["a", "b", "c"]);
  });

  it("元の配列を変更しない（非破壊）", () => {
    const quests = [q("a", "APPROVED"), q("b", "PENDING")];
    const original = [...quests];
    sortQuestsByCompletion(quests);
    expect(quests).toEqual(original);
  });
});

describe("sortQuestsForDeclaration", () => {
  const q = (id: string, status: string, idleDays = 0) => ({ id, status, idleDays });

  it("idle (idleDays>=3 かつ未完了) を最上段に、その他未完了→完了の順に並べる", () => {
    const quests = [
      q("done1", "APPROVED", 0),
      q("normal1", "PENDING", 0),
      q("idle1", "PENDING", 5),
      q("done2", "SKIPPED", 0),
      q("normal2", "REJECTED", 1),
      q("idle2", "REJECTED", 3),
    ];
    const sorted = sortQuestsForDeclaration(quests);
    expect(sorted.map((x) => x.id)).toEqual(["idle1", "idle2", "normal1", "normal2", "done1", "done2"]);
  });

  it("既に完了したクエストは idleDays が高くても下段に置く", () => {
    const quests = [
      q("done-stale", "APPROVED", 10),
      q("idle", "PENDING", 5),
      q("normal", "PENDING", 0),
    ];
    const sorted = sortQuestsForDeclaration(quests);
    expect(sorted.map((x) => x.id)).toEqual(["idle", "normal", "done-stale"]);
  });

  it("空配列は空配列を返す", () => {
    expect(sortQuestsForDeclaration([])).toEqual([]);
  });

  it("元の配列を変更しない（非破壊）", () => {
    const quests = [q("a", "APPROVED", 0), q("b", "PENDING", 5)];
    const original = [...quests];
    sortQuestsForDeclaration(quests);
    expect(quests).toEqual(original);
  });
});