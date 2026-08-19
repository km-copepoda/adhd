// @vitest-environment jsdom
//
// Issue #90: 決済導線が未実装のまま、ChildMonsterTheme への手動DB挿入によって
// 有料テーマ（現状 buddha, isFree: false）を「購入済み」として付与し、親画面から選択できるようにする。
// 対象: src/components/parent/MonsterThemeSelector.tsx（未実装。`ownedThemes` prop はこれから追加される）
//
// 期待するUI契約（implementer 実装時の参照用）:
//  - `MonsterThemeSelector` は `member` に加えて `ownedThemes: string[]` を prop として受け取る
//  - `isLocked = theme.isFree === false && !ownedThemes.includes(themeId)`
//    - isFree:false のテーマでも ownedThemes に含まれていれば選択可能（disabled=false）にする
//    - isFree:false のテーマが ownedThemes に含まれていなければ、従来通り選択不可（disabled=true, 「準備中」表示）にする
//  - isFree:true のテーマ（dark/light）は ownedThemes の内容に関わらず常に選択可能
//
// 実装がまだ存在しないため、これらのテストはすべて Red（失敗）になる想定。

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import MonsterThemeSelector from "@/components/parent/MonsterThemeSelector";

function baseMember(overrides: Partial<Parameters<typeof MonsterThemeSelector>[0]["member"]> = {}) {
  return {
    id: "child-1",
    evolutionStage: 0,
    rebirthPending: false,
    monsterSetId: "dark",
    pendingMonsterSetId: null,
    ...overrides,
  };
}

describe("MonsterThemeSelector: ownedThemes による有料テーマの選択制御（Issue #90）", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("ownedThemesにbuddhaが含まれる場合、buddhaボタンは有効(disabled=false)であること", () => {
    render(
      <MonsterThemeSelector member={baseMember()} ownedThemes={["dark", "light", "buddha"]} />,
    );

    const section = screen.getByTestId("monster-theme-section-child-1");
    const buddhaBtn = within(section).getByTestId(
      "monster-theme-option-child-1-buddha",
    ) as HTMLButtonElement;
    expect(buddhaBtn.disabled).toBe(false);
    expect(within(section).queryByText(/準備中/)).toBeNull();
  });

  it("ownedThemesにbuddhaが含まれる場合、buddhaボタンをクリックするとPATCH APIが呼ばれること", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ immediate: true, monsterSetId: "buddha" }),
    }) as unknown as typeof fetch;

    render(
      <MonsterThemeSelector
        member={baseMember({ evolutionStage: 0 })}
        ownedThemes={["dark", "light", "buddha"]}
      />,
    );

    const section = screen.getByTestId("monster-theme-section-child-1");
    fireEvent.click(within(section).getByTestId("monster-theme-option-child-1-buddha"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/family/members/child-1/monster-theme",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ themeId: "buddha" }),
        }),
      );
    });

    await waitFor(() => {
      expect(within(section).getByText(/テーマを変更しました/)).toBeTruthy();
    });
  });

  it("ownedThemesにbuddhaが含まれない場合、従来通りbuddhaボタンは無効(disabled=true)で「準備中」と表示されること（回帰確認）", () => {
    render(<MonsterThemeSelector member={baseMember()} ownedThemes={["dark", "light"]} />);

    const section = screen.getByTestId("monster-theme-section-child-1");
    const buddhaBtn = within(section).getByTestId(
      "monster-theme-option-child-1-buddha",
    ) as HTMLButtonElement;
    expect(buddhaBtn.disabled).toBe(true);
    expect(within(section).getByText(/準備中/)).toBeTruthy();
  });

  it("ownedThemesにbuddhaが含まれない場合、buddhaボタンをクリックしてもPATCH APIが呼ばれないこと（回帰確認）", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ immediate: true, monsterSetId: "buddha" }),
    }) as unknown as typeof fetch;

    render(<MonsterThemeSelector member={baseMember()} ownedThemes={["dark", "light"]} />);

    const section = screen.getByTestId("monster-theme-section-child-1");
    fireEvent.click(within(section).getByTestId("monster-theme-option-child-1-buddha"));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("境界値: ownedThemesが空配列でも、isFree:trueのテーマ(dark/light)は選択可能であること", () => {
    render(<MonsterThemeSelector member={baseMember()} ownedThemes={[]} />);

    const section = screen.getByTestId("monster-theme-section-child-1");
    const darkBtn = within(section).getByTestId(
      "monster-theme-option-child-1-dark",
    ) as HTMLButtonElement;
    const lightBtn = within(section).getByTestId(
      "monster-theme-option-child-1-light",
    ) as HTMLButtonElement;
    expect(darkBtn.disabled).toBe(false);
    expect(lightBtn.disabled).toBe(false);
  });
});
