// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => React.createElement("div", { "data-testid": "spinner" }),
}));

import PlanPage from "@/app/app/parent/(app)/plan/page";

function mockStatus(overrides: Record<string, unknown> = {}) {
  return {
    plan: "FREE",
    currentPeriodEnd: null,
    limits: { child: 1, task: 10, treasure_item: 5 },
    usage: {
      child: 1,
      perChild: [
        { childId: "child-1", displayName: "たろう", taskCount: 3, treasureItemCount: 1 },
      ],
    },
    ...overrides,
  };
}

function setFetch(status: Record<string, unknown>, ok = true, httpStatus = 200) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: httpStatus,
    json: () => Promise.resolve(status),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("親 プラン管理ページ", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("マウント時に /api/subscription/status を1回だけ取得する", async () => {
    const fetchMock = setFetch(mockStatus());
    render(<PlanPage />);
    await waitFor(() => expect(screen.queryByTestId("spinner")).toBeNull());

    const calls = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/subscription/status"));
    expect(calls).toHaveLength(1);
  });

  it("FREE プランは「無料プラン」と表示される", async () => {
    setFetch(mockStatus({ plan: "FREE", currentPeriodEnd: null }));
    render(<PlanPage />);
    await waitFor(() => {
      expect(document.body.textContent ?? "").toMatch(/無料プラン/);
    });
  });

  it("PREMIUM かつ currentPeriodEnd=null は「無期限」と表示される", async () => {
    setFetch(
      mockStatus({
        plan: "PREMIUM",
        currentPeriodEnd: null,
        limits: { child: null, task: null, treasure_item: null },
      }),
    );
    render(<PlanPage />);
    await waitFor(() => {
      const body = document.body.textContent ?? "";
      expect(body).toMatch(/プレミアム/);
      expect(body).toMatch(/無期限/);
    });
  });

  it("PREMIUM かつ currentPeriodEnd ありは有効期限の日付を表示する", async () => {
    setFetch(
      mockStatus({
        plan: "PREMIUM",
        currentPeriodEnd: "2027-06-15T00:00:00.000Z",
        limits: { child: null, task: null, treasure_item: null },
      }),
    );
    render(<PlanPage />);
    await waitFor(() => {
      const body = document.body.textContent ?? "";
      expect(body).toMatch(/2027/);
    });
  });

  it("使用状況: 子アカウント数「n / 上限」が表示される", async () => {
    setFetch(mockStatus({ usage: { child: 1, perChild: [] }, limits: { child: 1, task: 10, treasure_item: 5 } }));
    render(<PlanPage />);
    await waitFor(() => {
      const body = document.body.textContent ?? "";
      expect(body).toMatch(/1\s*\/\s*1/);
    });
  });

  it("子ごとのタスク数・ごほうび数が表示名付きで表示される", async () => {
    setFetch(
      mockStatus({
        usage: {
          child: 1,
          perChild: [
            { childId: "child-1", displayName: "りゅうくん", taskCount: 3, treasureItemCount: 1 },
          ],
        },
      }),
    );
    render(<PlanPage />);
    await waitFor(() => {
      const body = document.body.textContent ?? "";
      expect(body).toMatch(/りゅうくん/);
      expect(body).toMatch(/3\s*\/\s*10/);
      expect(body).toMatch(/1\s*\/\s*5/);
    });
  });

  it("上限が null (無制限) の場合は「無制限」と表記する", async () => {
    setFetch(
      mockStatus({
        plan: "PREMIUM",
        limits: { child: null, task: null, treasure_item: null },
        usage: {
          child: 2,
          perChild: [
            { childId: "child-1", displayName: "たろう", taskCount: 20, treasureItemCount: 30 },
          ],
        },
      }),
    );
    render(<PlanPage />);
    await waitFor(() => {
      const body = document.body.textContent ?? "";
      expect(body).toMatch(/無制限/);
    });
  });

  it("FREE 時はアップグレードボタンが表示され disabled になっている (準備中)", async () => {
    setFetch(mockStatus({ plan: "FREE" }));
    render(<PlanPage />);
    await waitFor(() => {
      const button = screen.getByRole("button", { name: /アップグレード/ });
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it("PREMIUM 時は解約・カード変更ボタンが表示され disabled になっている (準備中)", async () => {
    setFetch(
      mockStatus({
        plan: "PREMIUM",
        currentPeriodEnd: null,
        limits: { child: null, task: null, treasure_item: null },
      }),
    );
    render(<PlanPage />);
    await waitFor(() => {
      const button = screen.getByRole("button", { name: /解約|カード変更/ });
      expect((button as HTMLButtonElement).disabled).toBe(true);
    });
  });

  it("取得失敗時はエラーメッセージを表示し、スピナーは消える", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "取得に失敗しました" }),
    }) as unknown as typeof fetch;
    render(<PlanPage />);
    await waitFor(() => {
      expect(screen.queryByTestId("spinner")).toBeNull();
      const body = document.body.textContent ?? "";
      expect(body).toMatch(/エラー|失敗/);
    });
  });

  it("初回レンダリング時はローディングスピナーを表示する", () => {
    setFetch(mockStatus());
    render(<PlanPage />);
    expect(screen.getByTestId("spinner")).toBeTruthy();
  });
});
