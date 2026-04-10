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
      questId: "q1",
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
    expect(result).toEqual({ questId: "q1", stamp: "🎉", questTitle: "タスクq1" });
  });

  it("前のリストが空（初回マウント時相当）でAPPROVED+スタンプでもnullを返すこと（再表示バグ防止）", () => {
    // 初回マウント時は prev=[] になるが、既承認クエストの祝福は表示しない
    const prev: ReturnType<typeof makeQuest>[] = [];
    const next = [makeQuest("q1", "APPROVED", "🌟")];
    expect(findNewlyStampedApproval(prev, next)).toBeNull();
  });

  it("前のリストが空でもスタンプなしのAPPROVEDはnullを返すこと", () => {
    const prev: ReturnType<typeof makeQuest>[] = [];
    const next = [makeQuest("q1", "APPROVED", null)];
    expect(findNewlyStampedApproval(prev, next)).toBeNull();
  });
});
