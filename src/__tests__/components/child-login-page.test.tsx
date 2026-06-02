// @vitest-environment jsdom
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: vi.fn().mockResolvedValue({}),
      signInAnonymously: vi.fn().mockResolvedValue({ data: { user: { id: "u" } }, error: null }),
    },
  }),
}));

import OnboardingPage from "@/app/app/child/login/page";

describe("/app/child/login ページ", () => {
  it("ファミリーコード欄: 入力中は raw のまま、blur で正規化される", () => {
    render(<OnboardingPage />);
    const input = screen.getByPlaceholderText("ABC123") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "ａｂｃ１２３" } });
    expect(input.value).toBe("ａｂｃ１２３");

    fireEvent.blur(input);
    expect(input.value).toBe("ABC123");
  });

  it("ユーザーコード欄: 入力中は raw のまま、blur で正規化される", () => {
    render(<OnboardingPage />);
    const input = screen.getByPlaceholderText("1234") as HTMLInputElement;

    fireEvent.change(input, { target: { value: "Ａ１Ｂ２Ｃ３" } });
    expect(input.value).toBe("Ａ１Ｂ２Ｃ３");

    fireEvent.blur(input);
    expect(input.value).toBe("123");
  });

  it("blur せずにログインボタンを押した場合でも正規化された値が送信される", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    // ログイン成功時に window.location.href が書き換わるのを許容
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "" },
    });

    render(<OnboardingPage />);
    const family = screen.getByPlaceholderText("ABC123") as HTMLInputElement;
    const child = screen.getByPlaceholderText("1234") as HTMLInputElement;

    fireEvent.change(family, { target: { value: "ａｂｃ１２３" } });
    fireEvent.change(child, { target: { value: "１２３４" } });

    const button = screen.getByRole("button", { name: /ログイン/ });
    fireEvent.click(button);

    // setTimeout / microtask の解決を待つ
    await new Promise((r) => setTimeout(r, 0));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ familyCode: "ABC123", childCode: "1234" });
  });
});
