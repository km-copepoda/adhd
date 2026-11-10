// @vitest-environment jsdom
// 子どもの匿名セッションが DB の子どもと紐付いていない（孤立した）状態から抜け出せない不具合の回帰テスト。
// 孤立セッションはミドルウェアには「子ども」と判定されるため /app/parent 等も子画面へ飛ばされ、
// 子画面の API は 401 を返して永久ローディングになり、ログアウトボタン（育成画面）にも到達できなかった。
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSignOut = vi.fn();
let mockPathname = "/app/child/quests";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));
const mockSignInAnonymously = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: mockSignOut, signInAnonymously: mockSignInAnonymously },
  }),
}));

import ChildLogoutButton from "@/components/child/ChildLogoutButton";
import ChildSessionGuard from "@/components/child/ChildSessionGuard";
import OnboardingPage from "@/app/app/child/login/page";
import { signOutSafely } from "@/lib/signOutSafely";

function href() {
  return (window.location as unknown as { href: string }).href;
}

beforeEach(() => {
  mockPathname = "/app/child/quests";
  Object.defineProperty(window, "location", { writable: true, value: { href: "" } });
  mockSignOut.mockResolvedValue({ error: null });
  mockSignInAnonymously.mockResolvedValue({ data: { user: { id: "anon" } }, error: null });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("signOutSafely", () => {
  it("通常の signOut が成功したらローカル削除は追加で呼ばない", async () => {
    await signOutSafely({ signOut: mockSignOut });
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it("signOut が error を返したら scope: local でセッションを確実に消す", async () => {
    mockSignOut.mockResolvedValueOnce({ error: new Error("network") });
    await signOutSafely({ signOut: mockSignOut });
    expect(mockSignOut).toHaveBeenLastCalledWith({ scope: "local" });
  });

  it("signOut が例外を投げても scope: local でセッションを消し、例外は外に出さない", async () => {
    mockSignOut.mockRejectedValueOnce(new Error("boom"));
    await expect(signOutSafely({ signOut: mockSignOut })).resolves.toBeUndefined();
    expect(mockSignOut).toHaveBeenLastCalledWith({ scope: "local" });
  });

  it("ローカル削除まで失敗しても例外は外に出さない", async () => {
    mockSignOut.mockRejectedValue(new Error("boom"));
    await expect(signOutSafely({ signOut: mockSignOut })).resolves.toBeUndefined();
  });
});

describe("子 ログアウトボタン: signOut 失敗時もセッションを残さない", () => {
  it("signOut が error を返しても scope: local で消してから /login に移動する", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockSignOut.mockResolvedValueOnce({ error: new Error("network") });
    render(<ChildLogoutButton />);
    fireEvent.click(screen.getByText("ログアウト").closest("button")!);
    await waitFor(() => expect(href()).toBe("/login"));
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

describe("子 ログイン画面: コード検証に失敗したら匿名セッションを残さない", () => {
  function typeAndSubmit() {
    render(<OnboardingPage />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ABCD2345" } });
    fireEvent.click(screen.getByRole("button", { name: /ログイン/ }));
  }

  it("child-rejoin が 4xx を返したら scope: local で signOut する", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "コードが正しくありません" }),
    }) as unknown as typeof fetch;
    typeAndSubmit();
    await screen.findByText("コードが正しくありません");
    // 1回目: ログイン前のクリア、2回目: 失敗後の孤立セッション削除
    expect(mockSignOut).toHaveBeenCalledTimes(2);
    expect(mockSignOut).toHaveBeenLastCalledWith({ scope: "local" });
    expect(href()).toBe("");
  });

  it("child-rejoin が通信エラーでも scope: local で signOut する", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    typeAndSubmit();
    await screen.findByText("エラーが発生しました。もう一度お試しください");
    expect(mockSignOut).toHaveBeenCalledTimes(2);
    expect(mockSignOut).toHaveBeenLastCalledWith({ scope: "local" });
  });

  it("成功時は signOut を追加で呼ばない（ログイン前のクリア1回のみ）", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }) as unknown as typeof fetch;
    typeAndSubmit();
    await waitFor(() => expect(href()).toBe("/app/child/quests"));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});

describe("ChildSessionGuard: 子画面で孤立セッションを検出したらログイン画面へ戻す", () => {
  function mockStatus(status: number) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve({}),
    }) as unknown as typeof fetch;
  }

  it("monster-status が 401 ならセッションを消して /app/child/login へ移動する", async () => {
    mockStatus(401);
    render(<ChildSessionGuard />);
    await waitFor(() => expect(href()).toBe("/app/child/login"));
    expect(mockSignOut).toHaveBeenCalled();
    expect(vi.mocked(global.fetch).mock.calls[0][0]).toBe("/api/monster-status");
  });

  it.each([200, 403, 500])("status %i では何もしない", async (status) => {
    mockStatus(status);
    render(<ChildSessionGuard />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    expect(href()).toBe("");
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("ログイン画面では API を呼ばない（未ログインで 401 → 同じ画面へ移動、の無限リロードを防ぐ）", async () => {
    mockPathname = "/app/child/login";
    mockStatus(401);
    render(<ChildSessionGuard />);
    await new Promise((r) => setTimeout(r, 10));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(href()).toBe("");
  });

  it("通信エラーでは何もしない（オフライン時に勝手にログアウトさせない）", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("offline")) as unknown as typeof fetch;
    render(<ChildSessionGuard />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 10));
    expect(href()).toBe("");
    expect(mockSignOut).not.toHaveBeenCalled();
  });
});
