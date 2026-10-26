import { describe, it, expect } from "vitest";
import { childRealtimeFilter, familyRealtimeFilter } from "@/lib/realtimeFilters";

describe("childRealtimeFilter", () => {
  it.each([
    ["User", "id=eq.child-1"],
    ["UserBadge", "userId=eq.child-1"],
    ["QuestInstance", "childId=eq.child-1"],
    ["TreasureLog", "childId=eq.child-1"],
  ] as const)("%s は自分の行だけに絞る (%s)", (table, expected) => {
    expect(childRealtimeFilter(table, "child-1")).toBe(expected);
  });

  it("userId が未取得なら undefined（フィルタなし）", () => {
    expect(childRealtimeFilter("QuestInstance", null)).toBeUndefined();
  });
});

describe("familyRealtimeFilter", () => {
  it.each([
    ["QuestInstance", "childId=in.(c1,c2)"],
    ["TreasureLog", "childId=in.(c1,c2)"],
    ["TaskTemplate", "assignedChildId=in.(c1,c2)"],
  ] as const)("%s は家族の子供に絞る (%s)", (table, expected) => {
    expect(familyRealtimeFilter(table, ["c1", "c2"])).toBe(expected);
  });

  it("子供が1人でも in で絞る", () => {
    expect(familyRealtimeFilter("QuestInstance", ["c1"])).toBe("childId=in.(c1)");
  });

  it("子供の一覧が空なら null（購読不要）", () => {
    expect(familyRealtimeFilter("QuestInstance", [])).toBeNull();
  });

  it("子供の一覧が取得できない (null) なら undefined（フィルタなしにフォールバック）", () => {
    expect(familyRealtimeFilter("QuestInstance", null)).toBeUndefined();
  });
});
