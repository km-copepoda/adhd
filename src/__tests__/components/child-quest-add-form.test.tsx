// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import QuestAddForm from "@/components/child/QuestAddForm";

function setupFetch({
  limitOk = true,
  limitBody = { limit: 10, current: 0 },
  postOk = true,
  postStatus = 200,
  postBody = {} as Record<string, unknown>,
}: {
  limitOk?: boolean;
  limitBody?: Record<string, unknown>;
  postOk?: boolean;
  postStatus?: number;
  postBody?: Record<string, unknown>;
} = {}) {
  const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes("/api/subscription/child-task-limit")) {
      return limitOk
        ? Promise.resolve({ ok: true, json: () => Promise.resolve(limitBody) })
        : Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
    }
    if (url.includes("/api/tasks") && init?.method === "POST") {
      return Promise.resolve({ ok: postOk, status: postStatus, json: () => Promise.resolve(postBody) });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

async function fillTitleAndSubmit(title = "宿題") {
  fireEvent.change(screen.getByPlaceholderText("タスク名を入力..."), {
    target: { value: title },
  });
  fireEvent.click(screen.getByRole("button", { name: /追加する/ }));
}

describe("子 QuestAddForm: タスク追加の preempt チェック (Issue #148)", () => {
  let alertSpy: ReturnType<typeof vi.spyOn>;
  const onClose = vi.fn();
  const onAdded = vi.fn();

  beforeEach(() => {
    alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    onClose.mockReset();
    onAdded.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("マウント時に /api/subscription/child-task-limit を取得する", async () => {
    const fetchMock = setupFetch();
    render(<QuestAddForm onClose={onClose} onAdded={onAdded} />);
    await waitFor(() => {
      const calls = fetchMock.mock.calls.filter((c) =>
        String(c[0]).includes("/api/subscription/child-task-limit"),
      );
      expect(calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("上限未満 (9/10) なら POST /api/tasks が送信される", async () => {
    const fetchMock = setupFetch({ limitBody: { limit: 10, current: 9 } });
    render(<QuestAddForm onClose={onClose} onAdded={onAdded} />);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]).includes("child-task-limit")),
      ).toBe(true),
    );

    await fillTitleAndSubmit();

    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(
        (c) => String(c[0]).includes("/api/tasks") && (c[1] as RequestInit)?.method === "POST",
      );
      expect(postCalls).toHaveLength(1);
    });
  });

  it("上限到達 (10/10) なら POST を送信せず、数字・プラン名を含まない固定文言で alert する", async () => {
    const fetchMock = setupFetch({ limitBody: { limit: 10, current: 10 } });
    render(<QuestAddForm onClose={onClose} onAdded={onAdded} />);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]).includes("child-task-limit")),
      ).toBe(true),
    );

    await fillTitleAndSubmit();

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    const postCalls = fetchMock.mock.calls.filter(
      (c) => String(c[0]).includes("/api/tasks") && (c[1] as RequestInit)?.method === "POST",
    );
    expect(postCalls).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();

    const shown = alertSpy.mock.calls[0]?.[0] as string;
    expect(shown).not.toMatch(/\d/); // 数値を含まない
    expect(shown).not.toMatch(/プレミアム|プラン|FREE|PREMIUM/); // プラン名・課金文言を含まない
  });

  it("child-task-limit 取得に失敗した場合はフェイルオープンで POST を送信する", async () => {
    const fetchMock = setupFetch({ limitOk: false });
    render(<QuestAddForm onClose={onClose} onAdded={onAdded} />);

    await fillTitleAndSubmit();

    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(
        (c) => String(c[0]).includes("/api/tasks") && (c[1] as RequestInit)?.method === "POST",
      );
      expect(postCalls).toHaveLength(1);
    });
  });

  it("preempt を通過しても、サーバが 403 PLAN_LIMIT_EXCEEDED を返した場合は子供向け固定文言で alert する (サーバ文言をそのまま出さない)", async () => {
    setupFetch({
      limitBody: { limit: 10, current: 0 }, // クライアント側は上限未満と判断するが、サーバでは競合により上限超過
      postOk: false,
      postStatus: 403,
      postBody: {
        error: "無料プランではタスクは10個までです。プレミアムプランで無制限になります。",
        code: "PLAN_LIMIT_EXCEEDED",
        resource: "task",
      },
    });
    render(<QuestAddForm onClose={onClose} onAdded={onAdded} />);

    await fillTitleAndSubmit();

    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    const shown = alertSpy.mock.calls[0]?.[0] as string;
    expect(shown).not.toMatch(/プレミアム|10個/);
  });

  it("PLAN_LIMIT_EXCEEDED 以外のサーバエラーはサーバのエラー文言をそのまま alert する (回帰)", async () => {
    setupFetch({
      limitBody: { limit: 10, current: 0 },
      postOk: false,
      postStatus: 400,
      postBody: { error: "タスク名は必須です" },
    });
    render(<QuestAddForm onClose={onClose} onAdded={onAdded} />);

    await fillTitleAndSubmit();

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("タスク名は必須です"));
  });
});
