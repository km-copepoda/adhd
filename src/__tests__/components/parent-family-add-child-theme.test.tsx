// @vitest-environment jsdom
//
// 子供作成フォームで、家族が所持している有料テーマを選べる。
// 対象: src/app/app/parent/(app)/family/page.tsx
//
// UI契約:
//  - 「+ 子どもを追加」で開くフォームに `data-testid="add-child-theme-select"` の <select> を表示する
//  - 既定値は "" （「スタイルに合わせる」）。option は既定 + 所持済みの有料テーマ（isFree===false）のみ
//  - 所持していない有料テーマは option に出さない
//  - 所持済みの有料テーマが1つも無い場合は <select> 自体を表示しない
//  - 有料テーマを選んで追加すると POST /api/family/members の body に themeId が入る
//  - 既定のまま追加した場合、body に themeId を含めない

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: vi.fn().mockResolvedValue({}) },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  }),
}));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt?: string }) => React.createElement("img", { alt }),
}));
vi.mock("@/components/LoadingSpinner", () => ({
  default: () => React.createElement("div", { "data-testid": "spinner" }),
}));

import FamilyPage from "@/app/app/parent/(app)/family/page";

function mockFetch(ownedThemes: string[] | undefined) {
  const postCalls: RequestInit[] = [];
  global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    if (url === "/api/family/code") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ code: "ABC123", members: [], ownedThemes }),
      });
    }
    if (url === "/api/family/members" && options?.method === "POST") {
      postCalls.push(options);
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: "c1" }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
  return postCalls;
}

async function openForm() {
  render(<FamilyPage />);
  fireEvent.click(await screen.findByText("+ 子どもを追加"));
  return (await screen.findByTestId("add-child-theme-select")) as HTMLSelectElement;
}

async function openFormWithoutTheme() {
  render(<FamilyPage />);
  fireEvent.click(await screen.findByText("+ 子どもを追加"));
  await screen.findByPlaceholderText("例: りゅうくん");
}

describe("親 ファミリーページ: 子供作成フォームのテーマ選択", () => {
  afterEach(() => vi.clearAllMocks());

  it("既定 + 所持済み有料テーマのみがoptionに並び、未所持の有料テーマは出ない", async () => {
    mockFetch(["dark", "light", "buddha"]);
    const select = await openForm();
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(["", "buddha"]);
    expect(select.value).toBe("");
  });

  it("所持済み有料テーマが無い場合はテーマ選択を表示しない", async () => {
    mockFetch(["dark", "light"]);
    await openFormWithoutTheme();
    expect(screen.queryByTestId("add-child-theme-select")).toBeNull();
  });

  it("ownedThemesが未返却でもテーマ選択を出さずに描画できる", async () => {
    mockFetch(undefined);
    await openFormWithoutTheme();
    expect(screen.queryByTestId("add-child-theme-select")).toBeNull();
  });

  it("有料テーマを選んで追加すると、POST bodyにthemeIdが含まれる", async () => {
    const posts = mockFetch(["dark", "light", "buddha"]);
    const select = await openForm();
    fireEvent.change(screen.getByPlaceholderText("例: りゅうくん"), { target: { value: "たろう" } });
    fireEvent.change(select, { target: { value: "buddha" } });
    fireEvent.click(screen.getByText("追加"));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(JSON.parse(posts[0].body as string)).toMatchObject({ monsterName: "たろう", themeId: "buddha" });
  });

  it("既定のまま追加すると、POST bodyにthemeIdが含まれない", async () => {
    const posts = mockFetch(["dark", "light", "buddha"]);
    await openForm();
    fireEvent.change(screen.getByPlaceholderText("例: りゅうくん"), { target: { value: "たろう" } });
    fireEvent.click(screen.getByText("追加"));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(JSON.parse(posts[0].body as string).themeId).toBeUndefined();
  });
});
