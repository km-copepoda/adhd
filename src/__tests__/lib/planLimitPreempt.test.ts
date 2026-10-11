import { describe, it, expect } from "vitest";
import { isTaskCountedForLimit, countActiveTasksForChildClient } from "@/lib/planLimitPreempt";

/**
 * サーバ側 countActiveTasksForChild (src/lib/subscriptionService.ts) と同じ「有効タスク」の
 * 定義をクライアント側で再現する純粋関数のテスト。
 * GET /api/tasks の親レスポンスは既に isActive: true で絞られている前提のため、
 * ここでの判定対象は pausedAt / isTemporary+targetDate のみ (isActive は含めない)。
 * 仕様: Issue #148 v2差分 4番
 */

const todayStr = "2026-06-15";

function task(overrides: Partial<Parameters<typeof isTaskCountedForLimit>[0]> = {}) {
  return {
    assignedChildId: "child-1",
    pausedAt: null,
    isTemporary: false,
    targetDate: null,
    ...overrides,
  };
}

describe("isTaskCountedForLimit", () => {
  it("通常タスク (isTemporary=false) は targetDate が無くてもカウント対象", () => {
    expect(isTaskCountedForLimit(task(), "child-1", todayStr)).toBe(true);
  });

  it("assignedChildId が対象の子でなければカウントしない", () => {
    expect(isTaskCountedForLimit(task({ assignedChildId: "child-2" }), "child-1", todayStr)).toBe(
      false,
    );
  });

  it("pausedAt が設定されている (停止中) タスクはカウントしない", () => {
    expect(
      isTaskCountedForLimit(task({ pausedAt: "2026-06-01T00:00:00.000Z" }), "child-1", todayStr),
    ).toBe(false);
  });

  it("targetDate が today より過去の一時タスク (幽霊) はカウントしない", () => {
    expect(
      isTaskCountedForLimit(
        task({ isTemporary: true, targetDate: "2026-06-14T00:00:00.000Z" }),
        "child-1",
        todayStr,
      ),
    ).toBe(false);
  });

  it("targetDate が today と同日の一時タスクはカウントする (境界値: 当日はまだ幽霊でない)", () => {
    expect(
      isTaskCountedForLimit(
        task({ isTemporary: true, targetDate: "2026-06-15T00:00:00.000Z" }),
        "child-1",
        todayStr,
      ),
    ).toBe(true);
  });

  it("targetDate が today より未来の一時タスクはカウントする", () => {
    expect(
      isTaskCountedForLimit(
        task({ isTemporary: true, targetDate: "2026-06-16T00:00:00.000Z" }),
        "child-1",
        todayStr,
      ),
    ).toBe(true);
  });

  it("targetDate が null の一時タスクは幽霊判定にならずカウントする", () => {
    expect(
      isTaskCountedForLimit(task({ isTemporary: true, targetDate: null }), "child-1", todayStr),
    ).toBe(true);
  });

  it("createdBy=CHILD の申請中タスクなど、余分なフィールドが付いていてもカウント判定に影響しない", () => {
    const t = { ...task(), createdBy: "CHILD" } as ReturnType<typeof task> & {
      createdBy: string;
    };
    expect(isTaskCountedForLimit(t, "child-1", todayStr)).toBe(true);
  });
});

describe("countActiveTasksForChildClient", () => {
  it("対象の子について、停止中・期限切れ一時タスクを除いた件数を返す", () => {
    const tasks = [
      task({ assignedChildId: "child-1" }), // count
      task({ assignedChildId: "child-1", pausedAt: "2026-06-01T00:00:00.000Z" }), // 停止中: 除外
      task({
        assignedChildId: "child-1",
        isTemporary: true,
        targetDate: "2026-06-10T00:00:00.000Z",
      }), // 幽霊: 除外
      task({ assignedChildId: "child-1", isTemporary: true, targetDate: "2026-06-20T00:00:00.000Z" }), // count
      task({ assignedChildId: "child-2" }), // 別の子: 除外
    ];
    expect(countActiveTasksForChildClient(tasks, "child-1", todayStr)).toBe(2);
  });

  it("空配列は0", () => {
    expect(countActiveTasksForChildClient([], "child-1", todayStr)).toBe(0);
  });

  it("子供の承認待ち (createdBy=CHILD) タスクも数える", () => {
    const tasks = [
      { ...task({ assignedChildId: "child-1" }), createdBy: "CHILD" },
      { ...task({ assignedChildId: "child-1" }), createdBy: "PARENT" },
    ];
    expect(countActiveTasksForChildClient(tasks, "child-1", todayStr)).toBe(2);
  });
});
