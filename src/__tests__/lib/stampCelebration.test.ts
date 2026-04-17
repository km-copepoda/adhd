import { describe, it, expect } from "vitest";
import { findNewlyStampedApprovals } from "@/lib/stampCelebration";

const makeQuest = (id: string, status: string, stamp: string | null = null) => ({
  id,
  status,
  approvalStamp: stamp,
  template: { title: `タスク${id}` },
});

describe("findNewlyStampedApprovals", () => {
  it("REPORTED → APPROVED + スタンプ の変化を検知すること", () => {
    const prev = [makeQuest("q1", "REPORTED")];
    const next = [makeQuest("q1", "APPROVED", "⭐")];
    expect(findNewlyStampedApprovals(prev, next)).toEqual([
      { questId: "q1", stamp: "⭐", questTitle: "タスクq1" },
    ]);
  });

  it("スタンプなしの承認は検知しないこと", () => {
    const prev = [makeQuest("q1", "REPORTED")];
    const next = [makeQuest("q1", "APPROVED", null)];
    expect(findNewlyStampedApprovals(prev, next)).toEqual([]);
  });

  it("すでにAPPROVEDのクエストは再検知しないこと", () => {
    const prev = [makeQuest("q1", "APPROVED", "⭐")];
    const next = [makeQuest("q1", "APPROVED", "⭐")];
    expect(findNewlyStampedApprovals(prev, next)).toEqual([]);
  });

  it("複数クエストが同時に承認された場合は全件返すこと", () => {
    const prev = [makeQuest("q1", "REPORTED"), makeQuest("q2", "REPORTED")];
    const next = [makeQuest("q1", "APPROVED", "🎉"), makeQuest("q2", "APPROVED", "👏")];
    const result = findNewlyStampedApprovals(prev, next);
    expect(result).toEqual([
      { questId: "q1", stamp: "🎉", questTitle: "タスクq1" },
      { questId: "q2", stamp: "👏", questTitle: "タスクq2" },
    ]);
  });

  it("前のリストが空（初回マウント時相当）でAPPROVED+スタンプでも空配列を返すこと（再表示バグ防止）", () => {
    const prev: ReturnType<typeof makeQuest>[] = [];
    const next = [makeQuest("q1", "APPROVED", "🌟")];
    expect(findNewlyStampedApprovals(prev, next)).toEqual([]);
  });

  it("前のリストが空でもスタンプなしのAPPROVEDは空配列を返すこと", () => {
    const prev: ReturnType<typeof makeQuest>[] = [];
    const next = [makeQuest("q1", "APPROVED", null)];
    expect(findNewlyStampedApprovals(prev, next)).toEqual([]);
  });

  it("一部だけ新規承認の場合は新規のみ返すこと", () => {
    const prev = [makeQuest("q1", "APPROVED", "⭐"), makeQuest("q2", "REPORTED")];
    const next = [makeQuest("q1", "APPROVED", "⭐"), makeQuest("q2", "APPROVED", "🎊")];
    expect(findNewlyStampedApprovals(prev, next)).toEqual([
      { questId: "q2", stamp: "🎊", questTitle: "タスクq2" },
    ]);
  });
});
