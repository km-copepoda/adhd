// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: vi.fn().mockResolvedValue({}),
      signInAnonymously: vi.fn().mockResolvedValue({ data: { user: { id: "u" } }, error: null }),
    },
  }),
}));

import OnboardingPage from "@/app/app/child/login/page";

function mockFetch(ok = true, body: Record<string, unknown> = {}) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

beforeEach(() => {
  // ログイン成功時に window.location.href が書き換わるのを許容
  Object.defineProperty(window, "location", { writable: true, value: { href: "" } });
});

describe("/app/child/login ページ（ログインコード1つ）", () => {
  it("入力欄は「ログインコード」の1つだけで、ファミリーコード・ユーザーコード欄はないこと", () => {
    render(<OnboardingPage />);
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByText("ログインコード")).toBeInTheDocument();
    expect(screen.queryByText("ファミリーコード")).not.toBeInTheDocument();
    expect(screen.queryByText("ユーザーコード")).not.toBeInTheDocument();
  });

  it("入力中は raw のまま、blur で半角・大文字に正規化される", () => {
    render(<OnboardingPage />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "ａｂｃｄ２３４５" } });
    expect(input.value).toBe("ａｂｃｄ２３４５");

    fireEvent.blur(input);
    expect(input.value).toBe("ABCD2345");
  });

  it("blur せずにログインボタンを押しても、正規化された { loginCode } だけが送信される", async () => {
    const fetchMock = mockFetch();
    render(<OnboardingPage />);
    const input = screen.getByRole("textbox") as HTMLInputElement;

    fireEvent.change(input, { target: { value: " ａｂｃｄ２３４５ " } });
    fireEvent.click(screen.getByRole("button", { name: /ログイン/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/child-rejoin");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ loginCode: "ABCD2345" });
  });

  it.each([
    { label: "空", value: "" },
    { label: "7文字（境界）", value: "ABCD234" },
  ])("$label の場合は送信せずエラーを表示する", async ({ value }) => {
    const fetchMock = mockFetch();
    const { container } = render(<OnboardingPage />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: /ログイン/ }));

    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector("p.text-red-400")).not.toBeNull();
  });

  it("サーバーがエラーを返したらそのメッセージを表示し、遷移しない", async () => {
    mockFetch(false, { error: "コードが正しくありません" });
    render(<OnboardingPage />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ABCD2345" } });
    fireEvent.click(screen.getByRole("button", { name: /ログイン/ }));

    expect(await screen.findByText("コードが正しくありません")).toBeInTheDocument();
    expect(window.location.href).toBe("");
  });
});
