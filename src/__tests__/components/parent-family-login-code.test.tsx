// @vitest-environment jsdom
//
// #184: 親の家族管理画面は、ユーザーコードの表示をやめ、子どもごとに
// 「ログインコードを発行」ボタン（ChildLoginCodeIssuer）を出す。
// 対象: src/app/app/parent/(app)/family/page.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
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

const child = (id: string, name: string) => ({
  id,
  name,
  role: "CHILD",
  side: "LIGHT",
  monsterName: `${name}のモンスター`,
  evolutionStage: 0,
  evolutionPath: "",
  rebirthEggBonus: null,
  rebirthPending: false,
  minTasksForStreak: 1,
  reportDeadlineTime: null,
  checkinDeadlineTime: null,
  questTimeNotifyEnabled: true,
  studyPt: 0,
  staminaPt: 0,
  lifePt: 0,
  collectedPaths: "[]",
  monsterSetId: "dark",
  pendingMonsterSetId: null,
  ownedThemes: ["dark", "light"],
});

function mockFetch(members: unknown[]) {
  const fetchMock = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    if (url.includes("/login-code") && options?.method === "POST") {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            code: "WXYZ6789",
            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          }),
      });
    }
    if (url.includes("/api/family/code")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ code: "ABC123", members }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("親 ファミリーページ: ログインコード発行（#184）", () => {
  it("ユーザーコード（旧仕様）の表示はなく、子どもごとに発行ボタンが表示される", async () => {
    mockFetch([child("child-1", "たろう"), child("child-2", "はなこ")]);
    render(<FamilyPage />);

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "ログインコードを発行" })).toHaveLength(2),
    );
    expect(screen.queryByText("ユーザーコード")).not.toBeInTheDocument();
  });

  it("発行ボタンを押すとその子の発行 API が呼ばれ、コードが表示される", async () => {
    const fetchMock = mockFetch([child("child-1", "たろう"), child("child-2", "はなこ")]);
    render(<FamilyPage />);

    const buttons = await screen.findAllByRole("button", { name: "ログインコードを発行" });
    fireEvent.click(buttons[1]);

    expect(await screen.findByText("WXYZ6789")).toBeInTheDocument();
    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes("/login-code"));
    expect(call?.[0]).toBe("/api/family/members/child-2/login-code");
  });

  it("説明文から「ファミリーコード＋ユーザーコード」の旧手順が消えている", async () => {
    mockFetch([child("child-1", "たろう")]);
    render(<FamilyPage />);
    await screen.findByRole("button", { name: "ログインコードを発行" });
    expect(screen.queryByText(/ユーザーコード/)).not.toBeInTheDocument();
  });
});
