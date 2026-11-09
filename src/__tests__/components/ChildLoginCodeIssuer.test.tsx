// @vitest-environment jsdom
//
// 親の家族管理画面で使う「ログインコードを発行」ボタン（#184）。
// 対象: src/components/parent/ChildLoginCodeIssuer.tsx（default export, props: { childId: string }）
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ChildLoginCodeIssuer from "@/components/parent/ChildLoginCodeIssuer";

function mockFetch(ok: boolean, body: Record<string, unknown>) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

beforeEach(() => vi.clearAllMocks());

describe("ChildLoginCodeIssuer", () => {
  it("初期状態では「ログインコードを発行」ボタンだけが表示され、API は呼ばれない", () => {
    const fetchMock = mockFetch(true, {});
    render(<ChildLoginCodeIssuer childId="child-1" />);
    expect(screen.getByRole("button", { name: "ログインコードを発行" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ボタンを押すと発行 API を POST し、コードと残り時間を表示する", async () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const fetchMock = mockFetch(true, { code: "ABCD2345", expiresAt });
    render(<ChildLoginCodeIssuer childId="child-1" />);

    fireEvent.click(screen.getByRole("button", { name: "ログインコードを発行" }));

    expect(await screen.findByText("ABCD2345")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/family/members/child-1/login-code");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(screen.getByText(/残り/)).toBeInTheDocument();
  });

  it("API がエラーを返したらエラーメッセージを表示し、コードは表示しない", async () => {
    mockFetch(false, { error: "子供が見つかりません" });
    render(<ChildLoginCodeIssuer childId="child-1" />);

    fireEvent.click(screen.getByRole("button", { name: "ログインコードを発行" }));

    expect(await screen.findByText(/子供が見つかりません/)).toBeInTheDocument();
    expect(screen.queryByText(/残り/)).not.toBeInTheDocument();
  });

  it("ネットワーク例外でもエラー（role=alert）を表示する", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    render(<ChildLoginCodeIssuer childId="child-1" />);

    fireEvent.click(screen.getByRole("button", { name: "ログインコードを発行" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });

  it("再発行すると新しいコードに置き換わる", async () => {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ code: "AAAA2222", expiresAt }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ code: "BBBB3333", expiresAt }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    render(<ChildLoginCodeIssuer childId="child-1" />);

    fireEvent.click(screen.getByRole("button", { name: "ログインコードを発行" }));
    expect(await screen.findByText("AAAA2222")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /発行/ }));
    expect(await screen.findByText("BBBB3333")).toBeInTheDocument();
    expect(screen.queryByText("AAAA2222")).not.toBeInTheDocument();
  });
});
