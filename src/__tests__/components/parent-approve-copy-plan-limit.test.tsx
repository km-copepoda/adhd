// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({
      on: function () { return this; },
      subscribe: () => ({}),
    }),
    removeChannel: vi.fn(),
  }),
}));

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

const notifyApprovalsUpdated = vi.fn();
vi.mock("@/lib/approval-events", () => ({
  notifyApprovalsUpdated: (...args: unknown[]) => notifyApprovalsUpdated(...args),
}));

import ApprovePage from "@/app/app/parent/(app)/approve/page";

const SKIP_QUEST = {
  id: "q-1",
  templateId: "tpl-1",
  date: "2026-06-15",
  status: "SKIP_REPORTED",
  comment: null,
  photoUrl: null,
  deadlineBonusEarned: false,
  reportedAt: "2026-06-15T01:00:00.000Z",
  declaredToday: false,
  child: { name: "たろう", monsterName: "たろう", side: "LIGHT", reportDeadlineTime: null },
  template: { title: "おてつだい", emoji: "🧹", category: "LIFE", isTemporary: true, photoBonus: false },
};

/// Issue #148 v2差分 6番: 承認+コピーの複合操作で、コピーが PLAN_LIMIT_EXCEEDED で失敗しても
/// 承認結果の同期 (notifyApprovalsUpdated / 一覧再取得) は必ず実行されること。
describe("親 承認センター: スキップ承認+翌日コピーの上限到達 (Issue #148 v2差分6)", () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    notifyApprovalsUpdated.mockReset();
    confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupFetch(copyStatus: number, copyBody: Record<string, unknown>) {
    let pendingCallCount = 0;
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/approve/pending")) {
        pendingCallCount += 1;
        // 初回は承認待ち1件、2回目以降 (承認後の再取得) は空にする
        const body = pendingCallCount === 1 ? [SKIP_QUEST] : [];
        return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
      }
      if (url.includes("/api/approve/") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (url.includes("/api/tasks/") && url.includes("/copy")) {
        return Promise.resolve({ ok: false, status: copyStatus, json: () => Promise.resolve(copyBody) });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it("コピーが上限到達で失敗しても notifyApprovalsUpdated と一覧再取得は必ず実行される", async () => {
    const fetchMock = setupFetch(403, {
      error: "無料プランではタスクは10個までです。プレミアムプランで無制限になります。",
      code: "PLAN_LIMIT_EXCEEDED",
      resource: "task",
    });

    render(<ApprovePage />);
    await waitFor(() => expect(screen.queryByTestId("spinner")).toBeNull());

    // 「次の日に送る」を有効化
    fireEvent.click(screen.getByLabelText(/次の日に送る/));

    // カード本体をクリックして承認 (タイトルをクリックしてもバブリングで onClick が発火する)
    fireEvent.click(screen.getByText("おてつだい"));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));

    // コピー失敗後も承認結果の同期は必ず行われる
    expect(notifyApprovalsUpdated).toHaveBeenCalledTimes(1);
    const pendingCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/approve/pending"));
    expect(pendingCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("コピーが成功した場合も notifyApprovalsUpdated と一覧再取得が実行される (回帰)", async () => {
    const fetchMock = setupFetch(200, {});
    // 成功時は copyStatus を無視して ok:true を返すよう上書き
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/approve/pending")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([SKIP_QUEST]) });
      }
      if (url.includes("/api/approve/") && init?.method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (url.includes("/api/tasks/") && url.includes("/copy")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    });

    render(<ApprovePage />);
    await waitFor(() => expect(screen.queryByTestId("spinner")).toBeNull());

    fireEvent.click(screen.getByLabelText(/次の日に送る/));
    fireEvent.click(screen.getByText("おてつだい"));

    await waitFor(() => expect(notifyApprovalsUpdated).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
