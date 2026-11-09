// @vitest-environment jsdom
// Issue #190: 承認画面の二重送信ガード・res.ok 判定・差し戻し失敗時のモーダル保持・一括承認の確認
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => ({ on: function () { return this; }, subscribe: () => ({}) }),
    removeChannel: vi.fn(),
  }),
}));
vi.mock("@/components/LoadingSpinner", () => ({ default: () => <div data-testid="spinner" /> }));
vi.mock("@/lib/approval-events", () => ({ notifyApprovalsUpdated: vi.fn() }));

import ApprovePage from "@/app/app/parent/(app)/approve/page";

function quest(id: string, title: string) {
  return {
    id,
    kind: "quest",
    templateId: "tpl-" + id,
    date: "2026-06-15",
    status: "REPORTED",
    comment: null,
    photoUrl: null,
    deadlineBonusEarned: false,
    reportedAt: "2026-06-15T01:00:00.000Z",
    declaredToday: false,
    child: { name: "たろう", monsterName: "たろう", side: "LIGHT", reportDeadlineTime: null },
    template: { title, emoji: "🧹", category: "LIFE", isTemporary: false, photoBonus: false },
  };
}

const ITEMS = [quest("q-1", "おてつだい"), quest("q-2", "しゅくだい")];

type PostImpl = (url: string) => Promise<unknown>;
let fetchMock: ReturnType<typeof vi.fn>;

function setupFetch(post: PostImpl) {
  fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
    if (url.includes("/api/approve/pending")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(ITEMS) });
    }
    if (init?.method === "POST") return post(url);
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
}

const okRes = () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
const ngRes = () => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) });
const posts = () => fetchMock.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === "POST");

async function renderPage() {
  render(<ApprovePage />);
  await waitFor(() => expect(screen.queryByTestId("spinner")).toBeNull());
}

describe("親 承認センター: エラー処理 (#190)", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("承認ボタンの連打で POST が 1 回だけ飛ぶ", async () => {
    let resolvePost: (v: unknown) => void = () => {};
    setupFetch(() => new Promise((r) => { resolvePost = r; }));
    await renderPage();
    const btn = screen.getAllByRole("button", { name: /✓ 承認/ })[0];
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(posts().length).toBe(1);
    resolvePost({ ok: true, status: 200, json: () => Promise.resolve({}) });
  });

  it("カード本体（タイトル）をタップしても承認されない", async () => {
    setupFetch(okRes);
    await renderPage();
    fireEvent.click(screen.getByText("おてつだい"));
    expect(posts().length).toBe(0);
  });

  it("承認 API が 500 のときエラーを表示する", async () => {
    setupFetch(ngRes);
    await renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /✓ 承認/ })[0]);
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("承認 API が成功したときはエラーを表示しない", async () => {
    setupFetch(okRes);
    await renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /✓ 承認/ })[0]);
    await waitFor(() => expect(posts().length).toBe(1));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("差し戻しが失敗したときモーダルが残り、入力した理由も保持される", async () => {
    setupFetch(ngRes);
    await renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: "差し戻し" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    fireEvent.change(screen.getByPlaceholderText(/理由を入力/), { target: { value: "写真がちがう" } });
    fireEvent.click(screen.getByRole("button", { name: "差し戻す" }));
    await waitFor(() => expect(posts().length).toBe(1));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("差し戻し理由を選んでください")).toBeTruthy();
    expect((screen.getByPlaceholderText(/理由を入力/) as HTMLTextAreaElement).value).toBe("写真がちがう");
  });

  it("差し戻しが成功したときはモーダルが閉じる", async () => {
    setupFetch(okRes);
    await renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: "差し戻し" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "その他" }));
    fireEvent.change(screen.getByPlaceholderText(/理由を入力/), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "差し戻す" }));
    await waitFor(() => expect(screen.queryByText("差し戻し理由を選んでください")).toBeNull());
  });

  it("まとめて承認は確認を挟み、確認前は POST しない", async () => {
    setupFetch(okRes);
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /まとめて承認/ }));
    expect(posts().length).toBe(0);
    expect(screen.getByText(/2件をまとめて承認します/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "やめる" }));
    expect(posts().length).toBe(0);
  });

  it("まとめて承認の確認後は POST が 1 回だけで、連打しても増えない", async () => {
    let resolvePost: (v: unknown) => void = () => {};
    setupFetch(() => new Promise((r) => { resolvePost = r; }));
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /まとめて承認/ }));
    const confirmBtn = screen.getByRole("button", { name: "承認する" });
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);
    expect(posts().length).toBe(1);
    expect(posts()[0][0]).toContain("/api/approve/bulk");
    resolvePost({ ok: true, status: 200, json: () => Promise.resolve({}) });
  });

  it("まとめて承認が失敗したときエラーを表示する", async () => {
    setupFetch(ngRes);
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /まとめて承認/ }));
    fireEvent.click(screen.getByRole("button", { name: "承認する" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
  it("確認ダイアログを開いた後に一覧が変わっても、確認した 2 件だけを一括承認する (Codex指摘)", async () => {
    let current: unknown[] = ITEMS;
    fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes("/api/approve/pending")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(current) });
      }
      if (init?.method === "POST") return okRes();
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    await renderPage();
    fireEvent.click(screen.getByRole("button", { name: /まとめて承認/ }));
    // 確認中に新しい報告が届き、一覧が再取得される
    current = [...ITEMS, quest("q-3", "あたらしい報告")];
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(screen.getByText("あたらしい報告")).toBeTruthy());
    expect(screen.getByText(/2件をまとめて承認します/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "承認する" }));
    await waitFor(() => expect(posts().length).toBe(1));
    const body = JSON.parse((posts()[0][1] as RequestInit).body as string);
    expect(body.items).toEqual([
      { kind: "quest", id: "q-1" },
      { kind: "quest", id: "q-2" },
    ]);
  });
});
