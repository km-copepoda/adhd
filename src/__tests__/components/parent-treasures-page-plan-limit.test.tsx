// @vitest-environment jsdom
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "parent-1" } } }),
    },
  }),
}));

vi.mock("@/components/LoadingSpinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

import ParentTreasuresPage from "@/app/app/parent/(app)/treasures/page";

/// Issue #148: treasures/page.tsx の「ごほうび追加」呼び出しを confirmPlanLimitOrAlert に
/// 差し替える。v2差分1番 (res.ok のときだけ true) の契約が、この呼び出し口でも守られることを確認する。
describe("親 ごほうびページ: プラン上限到達時の誘導 (Issue #148)", () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, "confirm");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupFetch(addStatus: number, addBody: Record<string, unknown>, addOk: boolean) {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/family/code")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({ code: "ABC123", members: [{ id: "c1", name: "たろう", role: "CHILD" }] }),
        });
      }
      if (url.includes("/api/treasures") && (!init || init.method === undefined)) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ items: [], plan: "FREE" }) });
      }
      if (url === "/api/treasures" && init?.method === "POST") {
        return Promise.resolve({ ok: addOk, status: addStatus, json: () => Promise.resolve(addBody) });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it("FREE 上限到達 (PLAN_LIMIT_EXCEEDED) で追加に失敗すると confirm が表示され、OK を選んでも入力欄はクリアされない (回帰防止: v1バグ = confirm結果をそのまま返す実装ではフォームがクリアされてしまう)", async () => {
    confirmSpy.mockReturnValue(true); // OK (プラン管理ページへ) を選択
    const fetchMock = setupFetch(403, {
      error: "無料プランではごほうびは5個までです。プレミアムプランで無制限になります。",
      code: "PLAN_LIMIT_EXCEEDED",
      resource: "treasure_item",
    }, false);

    render(<ParentTreasuresPage />);
    await waitFor(() => expect(screen.queryByTestId("spinner")).toBeNull());

    const input = screen.getByPlaceholderText("例: アイスを買える") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "新しいごほうび" } });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));

    // 成功時の後処理 (入力欄クリア) が実行されていないこと = confirmPlanLimitOrAlert が false を返した証拠
    expect(input.value).toBe("新しいごほうび");

    const getCalls = fetchMock.mock.calls.filter(
      (c) => String(c[0]).includes("/api/treasures?childId"),
    );
    // 追加成功時のみ呼ばれる re-fetch が発生していないこと
    expect(getCalls).toHaveLength(1); // マウント時の1回のみ
  });

  it("上限未満なら通常通り追加に成功し、confirm は呼ばれない", async () => {
    const fetchMock = setupFetch(200, { id: "item-new" }, true);

    render(<ParentTreasuresPage />);
    await waitFor(() => expect(screen.queryByTestId("spinner")).toBeNull());

    const input = screen.getByPlaceholderText("例: アイスを買える") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "新しいごほうび" } });
    fireEvent.click(screen.getByRole("button", { name: "追加" }));

    await waitFor(() => {
      const getCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes("/api/treasures?childId"));
      expect(getCalls.length).toBeGreaterThanOrEqual(2); // マウント時 + 追加成功後の re-fetch
    });
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
