import { describe, it, expect } from "vitest";
import { findNewlyStampedApproval } from "@/lib/stampCelebration";

const makeQuest = (id: string, status: string, stamp: string | null = null) => ({
  id,
  status,
  approvalStamp: stamp,
  template: { title: `タスク${id}` },
});

describe("findNewlyStampedApproval", () => {
  it("REPORTED → APPROVED + スタンプ の変化を検知すること", () => {
    const prev = [makeQuest("q1", "REPORTED")];
    const next = [makeQuest("q1", "APPROVED", "⭐")];
    expect(findNewlyStampedApproval(prev, next)).toEqual({
      stamp: "⭐",
      questTitle: "タスクq1",
    });
  });

  it("スタンプなしの承認は検知しないこと", () => {
    const prev = [makeQuest("q1", "REPORTED")];
    const next = [makeQuest("q1", "APPROVED", null)];
    expect(findNewlyStampedApproval(prev, next)).toBeNull();
  });

  it("すでにAPPROVEDのクエストは再検知しないこと", () => {
    const prev = [makeQuest("q1", "APPROVED", "⭐")];
    const next = [makeQuest("q1", "APPROVED", "⭐")];
    expect(findNewlyStampedApproval(prev, next)).toBeNull();
  });

  it("複数クエストのうち最初の1件だけ返すこと", () => {
    const prev = [makeQuest("q1", "REPORTED"), makeQuest("q2", "REPORTED")];
    const next = [makeQuest("q1", "APPROVED", "🎉"), makeQuest("q2", "APPROVED", "👏")];
    const result = findNewlyStampedApproval(prev, next);
    expect(result).toEqual({ stamp: "🎉", questTitle: "タスクq1" });
  });

  it("前のリストにないクエスト（新規）が APPROVED+スタンプでも検知すること", () => {
    const prev: typeof makeQuest extends (...args: any[]) => infer R ? R[] : never = [];
    const next = [makeQuest("q-new", "APPROVED", "🌟")];
    expect(findNewlyStampedApproval(prev, next)).toEqual({
      stamp: "🌟",
      questTitle: "タスクq-new",
    });
  });

  it("前のリストが空でスタンプなしのAPPROVEDはnullを返すこと", () => {
    const prev: ReturnType<typeof makeQuest>[] = [];
    const next = [makeQuest("q1", "APPROVED", null)];
    expect(findNewlyStampedApproval(prev, next)).toBeNull();
  });
});
