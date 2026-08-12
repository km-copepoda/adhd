// @vitest-environment jsdom
import { render, waitFor, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => React.createElement("div", { "data-testid": "spinner" }),
}));

import TasksPage from "@/app/app/parent/(app)/tasks/page";

describe("親 タスク管理ページ: マウント時のfetch回数", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("マウント時に /api/tasks と /api/family/code がそれぞれ1回ずつ呼ばれる（fetchTasks/fetchChildrenの巻き上げ後も回帰しない）", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/tasks")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes("/api/family/code")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ code: "ABC123", members: [] }),
        });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<TasksPage />);

    await waitFor(() => {
      expect(screen.queryByTestId("spinner")).toBeNull();
    });

    const tasksCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/tasks"));
    const familyCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/family/code"));

    expect(tasksCalls).toHaveLength(1);
    expect(familyCalls).toHaveLength(1);
  });
});
