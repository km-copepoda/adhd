// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => React.createElement("div", { "data-testid": "spinner" }),
}));

import TasksPage from "@/app/app/parent/(app)/tasks/page";

const TITLE_PLACEHOLDER = "例: 算数ドリルをやる";

type RawTask = {
  id: string;
  title: string;
  emoji: string;
  category: string;
  repeatDays: number[];
  isTemporary: boolean;
  targetDate: string | null;
  requestedDate: string | null;
  isActive: boolean;
  pausedAt: string | null;
  createdBy: string;
  photoBonus: boolean;
  carryOver: boolean;
  assignedChildId: string | null;
  assignedChild: { id: string; monsterName: string | null } | null;
  taskStreaks: unknown[];
  completedToday: boolean;
  lastSkippedDate: string | null;
  lastSkippedActiveDaysAgo: number | null;
  carryOverMissedCount: number | null;
};

function makeTask(overrides: Partial<RawTask> = {}, i: number): RawTask {
  return {
    id: `t-${i}`,
    title: `タスク${i}`,
    emoji: "📚",
    category: "STUDY",
    repeatDays: [1, 2, 3, 4, 5],
    isTemporary: false,
    targetDate: null,
    requestedDate: null,
    isActive: true,
    pausedAt: null,
    createdBy: "PARENT",
    photoBonus: false,
    carryOver: false,
    assignedChildId: "child-1",
    assignedChild: { id: "child-1", monsterName: "たろう" },
    taskStreaks: [],
    completedToday: false,
    lastSkippedDate: null,
    lastSkippedActiveDaysAgo: null,
    carryOverMissedCount: null,
    ...overrides,
  };
}

const CHILD = {
  id: "child-1",
  role: "CHILD",
  monsterName: "たろう",
  reportDeadlineTime: null,
  lastLoginDate: null,
};

function setupFetch({
  tasks,
  limitsOk = true,
  limitsBody = { child: 1, task: 10, treasure_item: 5 },
}: {
  tasks: RawTask[];
  limitsOk?: boolean;
  limitsBody?: Record<string, unknown>;
}) {
  const fetchMock = vi.fn().mockImplementation((url: string) => {
    if (url.includes("/api/subscription/limits")) {
      return limitsOk
        ? Promise.resolve({ ok: true, json: () => Promise.resolve(limitsBody) })
        : Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
    }
    if (url.includes("/api/tasks")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(tasks) });
    }
    if (url.includes("/api/family/code")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ code: "ABC123", members: [CHILD] }),
      });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

async function renderReady() {
  render(<TasksPage />);
  await waitFor(() => expect(screen.queryByTestId("spinner")).toBeNull());
}

describe("親 タスク管理ページ: 追加ボタンの preempt チェック (Issue #148)", () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("マウント時に /api/subscription/limits を取得する", async () => {
    const fetchMock = setupFetch({ tasks: [] });
    await renderReady();
    const calls = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/subscription/limits"));
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  it("9/10 (上限未満) なら「+ タスク追加」でフォームが開く", async () => {
    const tasks = Array.from({ length: 9 }, (_, i) => makeTask({}, i));
    setupFetch({ tasks });
    await renderReady();

    fireEvent.click(screen.getByRole("button", { name: /\+ タスク追加/ }));

    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toBeTruthy();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("10/10 (上限到達) なら「+ タスク追加」でフォームが開かず、confirm が呼ばれる", async () => {
    const tasks = Array.from({ length: 10 }, (_, i) => makeTask({}, i));
    setupFetch({ tasks });
    await renderReady();

    fireEvent.click(screen.getByRole("button", { name: /\+ タスク追加/ }));

    expect(screen.queryByPlaceholderText(TITLE_PLACEHOLDER)).toBeNull();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
  });

  it("confirm で OK を選んでも POST /api/tasks は送信されない (preempt はサーバに到達させない)", async () => {
    confirmSpy.mockReturnValue(true);
    const tasks = Array.from({ length: 10 }, (_, i) => makeTask({}, i));
    const fetchMock = setupFetch({ tasks });
    await renderReady();

    fireEvent.click(screen.getByRole("button", { name: /\+ タスク追加/ }));

    const postCalls = fetchMock.mock.calls.filter(
      (c) => String(c[0]) === "/api/tasks" && (c[1] as RequestInit | undefined)?.method === "POST",
    );
    expect(postCalls).toHaveLength(0);
  });

  it("停止中タスクは上限カウントに含めない (10件中2件停止中 → 実質8件なのでフォームが開く)", async () => {
    const tasks = [
      ...Array.from({ length: 8 }, (_, i) => makeTask({}, i)),
      ...Array.from({ length: 2 }, (_, i) =>
        makeTask({ pausedAt: "2026-06-01T00:00:00.000Z" }, i + 8),
      ),
    ];
    setupFetch({ tasks });
    await renderReady();

    fireEvent.click(screen.getByRole("button", { name: /\+ タスク追加/ }));

    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toBeTruthy();
  });

  it("期限切れの一時タスク (幽霊) は上限カウントに含めない", async () => {
    const tasks = [
      ...Array.from({ length: 8 }, (_, i) => makeTask({}, i)),
      ...Array.from({ length: 2 }, (_, i) =>
        makeTask(
          { isTemporary: true, targetDate: "2000-01-01T00:00:00.000Z" },
          i + 8,
        ),
      ),
    ];
    setupFetch({ tasks });
    await renderReady();

    fireEvent.click(screen.getByRole("button", { name: /\+ タスク追加/ }));

    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toBeTruthy();
  });

  it("子の承認待ち (createdBy=CHILD) タスクも上限カウントに含める", async () => {
    const tasks = Array.from({ length: 10 }, (_, i) => makeTask({ createdBy: "CHILD" }, i));
    setupFetch({ tasks });
    await renderReady();

    fireEvent.click(screen.getByRole("button", { name: /\+ タスク追加/ }));

    expect(screen.queryByPlaceholderText(TITLE_PLACEHOLDER)).toBeNull();
    expect(confirmSpy).toHaveBeenCalledTimes(1);
  });

  it("limit === null (PREMIUM) は常にフェイルオープンでフォームが開く", async () => {
    const tasks = Array.from({ length: 20 }, (_, i) => makeTask({}, i));
    setupFetch({ tasks, limitsBody: { child: null, task: null, treasure_item: null } });
    await renderReady();

    fireEvent.click(screen.getByRole("button", { name: /\+ タスク追加/ }));

    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toBeTruthy();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("limits 取得に失敗した場合はフェイルオープンでフォームが開く", async () => {
    const tasks = Array.from({ length: 10 }, (_, i) => makeTask({}, i));
    setupFetch({ tasks, limitsOk: false });
    await renderReady();

    fireEvent.click(screen.getByRole("button", { name: /\+ タスク追加/ }));

    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toBeTruthy();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("編集フォームは上限到達中でも開く (preempt 対象外)", async () => {
    const tasks = Array.from({ length: 10 }, (_, i) => makeTask({}, i));
    setupFetch({ tasks });
    await renderReady();

    fireEvent.click(screen.getAllByRole("button", { name: "編集" })[0]);

    expect(screen.getByPlaceholderText(TITLE_PLACEHOLDER)).toBeTruthy();
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
