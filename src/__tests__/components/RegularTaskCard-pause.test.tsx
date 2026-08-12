// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import RegularTaskCard from "@/components/parent/RegularTaskCard";

function baseTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "t1",
    title: "宿題",
    emoji: "📚",
    category: "STUDY" as const,
    repeatDays: [1, 2, 3, 4, 5],
    isTemporary: false,
    photoBonus: false,
    carryOver: false,
    assignedChildId: "child-1",
    taskStreaks: [],
    completedToday: false,
    lastSkippedDate: null,
    carryOverMissedCount: null,
    targetDate: null,
    requestedDate: null,
    isActive: true,
    pausedAt: null,
    createdBy: "PARENT",
    ...overrides,
  };
}

describe("RegularTaskCard 一時停止ボタン", () => {
  const childOptions = [{ id: "child-1", reportDeadlineTime: null }];

  it("pausedAt=null のとき '⏸ 停止' ボタンを表示し、クリックで onTogglePause(id, true) を呼ぶ", () => {
    const onTogglePause = vi.fn();
    render(
      <RegularTaskCard
        task={baseTask()}
        childId="child-1"
        childOptions={childOptions}
        todayDow={1}
        onEdit={() => {}}
        onDelete={() => {}}
        onTogglePause={onTogglePause}
      />,
    );
    const btn = screen.getByRole("button", { name: /停止/ });
    expect(btn.textContent).toContain("⏸");
    fireEvent.click(btn);
    expect(onTogglePause).toHaveBeenCalledWith("t1", true);
  });

  it("pausedAt が入っているとき '▶ 再開' ボタンを表示し、クリックで onTogglePause(id, false) を呼ぶ", () => {
    const onTogglePause = vi.fn();
    render(
      <RegularTaskCard
        task={baseTask({ pausedAt: "2026-07-20T10:00:00Z" })}
        childId="child-1"
        childOptions={childOptions}
        todayDow={1}
        onEdit={() => {}}
        onDelete={() => {}}
        onTogglePause={onTogglePause}
      />,
    );
    const btn = screen.getByRole("button", { name: /再開/ });
    expect(btn.textContent).toContain("▶");
    fireEvent.click(btn);
    expect(onTogglePause).toHaveBeenCalledWith("t1", false);
  });

  it("pausedAt が入っているとき '⏸ 停止中' バッジを表示する", () => {
    render(
      <RegularTaskCard
        task={baseTask({ pausedAt: "2026-07-20T10:00:00Z" })}
        childId="child-1"
        childOptions={childOptions}
        todayDow={1}
        onEdit={() => {}}
        onDelete={() => {}}
        onTogglePause={() => {}}
      />,
    );
    expect(screen.getByText(/停止中/)).toBeTruthy();
  });

  it("pausedAt 中は '対象外' ラベルを表示しない（意味の重複を避ける）", () => {
    render(
      <RegularTaskCard
        task={baseTask({ pausedAt: "2026-07-20T10:00:00Z", repeatDays: [0] })}
        childId="child-1"
        childOptions={childOptions}
        todayDow={1}
        onEdit={() => {}}
        onDelete={() => {}}
        onTogglePause={() => {}}
      />,
    );
    expect(screen.queryByText("対象外")).toBeNull();
  });
});
