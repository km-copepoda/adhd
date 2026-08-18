// @vitest-environment jsdom
//
// Issue #85: 親画面からモンスターテーマの付与・切替を行う（モンスターテーマセット Stage2）
// 対象: src/app/app/parent/(app)/family/page.tsx（未実装。テーマ選択セクションはこれから追加される）
//
// 期待するUI契約（implementer 実装時の参照用）:
//  - 子ごとに `data-testid={`monster-theme-section-${member.id}`}` のセクションを表示する
//  - セクション内に @/lib/monsterThemes/index の MONSTER_THEMES（dark/light/buddha）ぶんの
//    選択ボタンを表示する。各ボタンは `data-testid={`monster-theme-option-${member.id}-${themeId}`}`
//    を持ち、テーマの label（"ダーク" / "ライト" / "仏様"）を表示する
//  - ボタン押下で PATCH /api/family/members/${member.id}/monster-theme を
//    body: { themeId } で叩く
//  - 即時反映（evolutionStage===0 または rebirthPending===true）の場合、
//    API レスポンス { immediate: true, monsterSetId } を受けて
//    「テーマを変更しました」等の成功メッセージを表示する
//  - 予約扱い（育成途中）の場合、API レスポンス { immediate: false, pendingMonsterSetId } を受けて
//    「次の転生からこのテーマになります」等の予約メッセージを表示する
//  - API がエラー（400/403等、ok:false + { error }）を返した場合はエラーメッセージを表示し、
//    選択中テーマの表示は変更しない
//  - pendingMonsterSetId が設定されている子については、現在のテーマ
//    （`data-testid={`monster-theme-current-${member.id}`}`）と
//    次回適用されるテーマ（`data-testid={`monster-theme-pending-${member.id}`}`）の
//    両方を表示する
//
// 実装がまだ存在しないため、これらのテストはすべて Red（失敗）になる想定。

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: vi.fn().mockResolvedValue({}) },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
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

type MockMember = {
  id: string;
  name: string;
  role: "PARENT" | "CHILD";
  side: string | null;
  monsterName: string | null;
  evolutionStage: number;
  evolutionPath: string;
  rebirthEggBonus: string | null;
  rebirthPending: boolean;
  childCode: string | null;
  minTasksForStreak: number;
  reportDeadlineTime: string | null;
  checkinDeadlineTime: string | null;
  questTimeNotifyEnabled: boolean;
  studyPt: number;
  staminaPt: number;
  lifePt: number;
  collectedPaths: string;
  monsterSetId: string;
  pendingMonsterSetId: string | null;
};

function makeChild(overrides: Partial<MockMember> = {}): MockMember {
  return {
    id: "child-1",
    name: "たろう",
    role: "CHILD",
    side: "LIGHT",
    monsterName: "たろうのモンスター",
    evolutionStage: 0,
    evolutionPath: "",
    rebirthEggBonus: null,
    rebirthPending: false,
    childCode: "1234",
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
    ...overrides,
  };
}

function mockFetchWithMembers(members: MockMember[], patchImpl?: (url: string, options: RequestInit) => Promise<Response>) {
  global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    if (url.includes("/api/family/code")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ code: "ABC123", members }),
      });
    }
    if (url.includes("/monster-theme") && options?.method === "PATCH") {
      if (patchImpl) return patchImpl(url, options);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ immediate: true, monsterSetId: "dark" }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  }) as unknown as typeof fetch;
}

describe("親 ファミリーページ: モンスターテーマ選択（Issue #85）", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("子ごとにテーマ選択UIが表示され、dark/light/buddhaの3択が見える", async () => {
    mockFetchWithMembers([makeChild()]);
    render(<FamilyPage />);

    const section = await waitFor(() => screen.getByTestId("monster-theme-section-child-1"));
    expect(within(section).getByTestId("monster-theme-option-child-1-dark")).toBeTruthy();
    expect(within(section).getByTestId("monster-theme-option-child-1-light")).toBeTruthy();
    expect(within(section).getByTestId("monster-theme-option-child-1-buddha")).toBeTruthy();
    expect(within(section).getByText("ダーク")).toBeTruthy();
    expect(within(section).getByText("ライト")).toBeTruthy();
    expect(within(section).getByText("仏様")).toBeTruthy();
  });

  it("テーマを選択すると PATCH /api/family/members/[id]/monster-theme が { themeId } で呼ばれること", async () => {
    mockFetchWithMembers([makeChild({ evolutionStage: 0 })]);
    render(<FamilyPage />);

    const section = await waitFor(() => screen.getByTestId("monster-theme-section-child-1"));
    fireEvent.click(within(section).getByTestId("monster-theme-option-child-1-buddha"));

    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const patchCall = calls.find(
        (c: unknown[]) =>
          typeof c[0] === "string" &&
          c[0].includes("/api/family/members/child-1/monster-theme"),
      );
      expect(patchCall).toBeTruthy();
      const [, options] = patchCall as [string, RequestInit];
      expect(options.method).toBe("PATCH");
      expect(JSON.parse(options.body as string)).toEqual({ themeId: "buddha" });
    });
  });

  it("即時反映された場合、成功メッセージが表示されること（卵 evolutionStage===0）", async () => {
    mockFetchWithMembers([makeChild({ evolutionStage: 0 })], () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ immediate: true, monsterSetId: "buddha" }),
      } as Response),
    );
    render(<FamilyPage />);

    const section = await waitFor(() => screen.getByTestId("monster-theme-section-child-1"));
    fireEvent.click(within(section).getByTestId("monster-theme-option-child-1-buddha"));

    await waitFor(() => {
      expect(within(section).getByText(/テーマを変更しました/)).toBeTruthy();
    });
  });

  it("即時反映された場合、成功メッセージが表示されること（rebirthPending===true）", async () => {
    mockFetchWithMembers(
      [makeChild({ evolutionStage: 3, rebirthPending: true })],
      () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ immediate: true, monsterSetId: "light" }),
        } as Response),
    );
    render(<FamilyPage />);

    const section = await waitFor(() => screen.getByTestId("monster-theme-section-child-1"));
    fireEvent.click(within(section).getByTestId("monster-theme-option-child-1-light"));

    await waitFor(() => {
      expect(within(section).getByText(/テーマを変更しました/)).toBeTruthy();
    });
  });

  it("予約扱いになった場合、次の転生から反映される旨のメッセージが表示されること（育成途中）", async () => {
    mockFetchWithMembers(
      [makeChild({ evolutionStage: 2, rebirthPending: false })],
      () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ immediate: false, pendingMonsterSetId: "buddha" }),
        } as Response),
    );
    render(<FamilyPage />);

    const section = await waitFor(() => screen.getByTestId("monster-theme-section-child-1"));
    fireEvent.click(within(section).getByTestId("monster-theme-option-child-1-buddha"));

    await waitFor(() => {
      expect(within(section).getByText(/次の転生からこのテーマになります/)).toBeTruthy();
    });
  });

  it("境界値: evolutionStage===1（卵ではない最小値）でも予約扱いになること", async () => {
    mockFetchWithMembers(
      [makeChild({ evolutionStage: 1, rebirthPending: false })],
      () =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ immediate: false, pendingMonsterSetId: "light" }),
        } as Response),
    );
    render(<FamilyPage />);

    const section = await waitFor(() => screen.getByTestId("monster-theme-section-child-1"));
    fireEvent.click(within(section).getByTestId("monster-theme-option-child-1-light"));

    await waitFor(() => {
      expect(within(section).getByText(/次の転生からこのテーマになります/)).toBeTruthy();
    });
  });

  it("APIがエラー(400)を返した場合、エラーメッセージが表示されテーマは変更されないこと", async () => {
    mockFetchWithMembers(
      [makeChild({ evolutionStage: 0, monsterSetId: "dark" })],
      () =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve({ error: "無効なテーマです" }),
        } as Response),
    );
    render(<FamilyPage />);

    const section = await waitFor(() => screen.getByTestId("monster-theme-section-child-1"));
    fireEvent.click(within(section).getByTestId("monster-theme-option-child-1-buddha"));

    await waitFor(() => {
      expect(within(section).getByText(/無効なテーマです|エラー|失敗/)).toBeTruthy();
    });

    // 成功・予約メッセージは表示されない
    expect(within(section).queryByText(/テーマを変更しました/)).toBeNull();
    expect(within(section).queryByText(/次の転生からこのテーマになります/)).toBeNull();
    // 選択中テーマ（dark）の表示は変わらない = buddha ボタンは選択済みにならない
    const buddhaBtn = within(section).getByTestId("monster-theme-option-child-1-buddha");
    expect(buddhaBtn.getAttribute("aria-pressed")).not.toBe("true");
  });

  it("APIがエラー(403)を返した場合、エラーメッセージが表示されること", async () => {
    mockFetchWithMembers(
      [makeChild({ evolutionStage: 0 })],
      () =>
        Promise.resolve({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ error: "権限がありません" }),
        } as Response),
    );
    render(<FamilyPage />);

    const section = await waitFor(() => screen.getByTestId("monster-theme-section-child-1"));
    fireEvent.click(within(section).getByTestId("monster-theme-option-child-1-light"));

    await waitFor(() => {
      expect(within(section).getByText(/権限がありません|エラー|失敗/)).toBeTruthy();
    });
  });

  it("予約中(pendingMonsterSetId設定済み)の子は、現在のテーマと次回適用テーマの両方が表示される", async () => {
    mockFetchWithMembers([
      makeChild({
        evolutionStage: 2,
        rebirthPending: false,
        monsterSetId: "dark",
        pendingMonsterSetId: "buddha",
      }),
    ]);
    render(<FamilyPage />);

    const section = await waitFor(() => screen.getByTestId("monster-theme-section-child-1"));
    const current = within(section).getByTestId("monster-theme-current-child-1");
    const pending = within(section).getByTestId("monster-theme-pending-child-1");
    expect(current.textContent).toMatch(/ダーク/);
    expect(pending.textContent).toMatch(/仏様/);
  });

  it("予約中でない(pendingMonsterSetId===null)の子には、次回適用テーマの表示が出ないこと", async () => {
    mockFetchWithMembers([
      makeChild({ evolutionStage: 2, rebirthPending: false, monsterSetId: "dark", pendingMonsterSetId: null }),
    ]);
    render(<FamilyPage />);

    const section = await waitFor(() => screen.getByTestId("monster-theme-section-child-1"));
    expect(within(section).queryByTestId("monster-theme-pending-child-1")).toBeNull();
  });
});
