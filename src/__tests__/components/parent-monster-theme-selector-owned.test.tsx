// @vitest-environment jsdom
//
// Issue #90: 決済導線が未実装のまま、ChildMonsterTheme への手動DB挿入によって
// 有料テーマ（現状 buddha, isFree: false）を「購入済み」として付与し、親画面から選択できるようにする。
// 対象: src/components/parent/MonsterThemeSelector.tsx（プルダウン化。<select>/<option> 形式に変更）
//
// 期待するUI契約（implementer 実装時の参照用）:
//  - `MonsterThemeSelector` は `member` に加えて `ownedThemes: string[]` を prop として受け取る
//  - テーマ一覧は `data-testid={`monster-theme-select-${member.id}`}` の <select> 内の
//    <option value={themeId}> として表示する
//  - `isLocked = theme.isFree === false && !ownedThemes.includes(themeId)`
//    - isFree:false のテーマでも ownedThemes に含まれていれば選択可能（option の disabled=false）にする
//    - isFree:false のテーマが ownedThemes に含まれていなければ、従来通り選択不可
//      （option の disabled=true、ラベル末尾に「準備中」を含む表示）にする
//  - isFree:true のテーマ（dark/light）は ownedThemes の内容に関わらず常に選択可能
//  - <select> の change イベントで、選択された themeId が isLocked な場合は
//    PATCH API を呼ばない（disabled option への直接値設定に対する防御）
//
// プルダウン化に伴い、これらのテストは Red（失敗）になる想定
// （現状の実装はボタン横並び形式のため <select> が存在しない）。

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

function getOption(select: HTMLSelectElement, value: string): HTMLOptionElement {
  const option = select.querySelector(`option[value="${value}"]`);
  if (!option) throw new Error(`option[value="${value}"] not found`);
  return option as HTMLOptionElement;
}

describe("MonsterThemeSelector: ownedThemes による有料テーマの選択制御（Issue #90, プルダウン化）", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("ownedThemesにbuddhaが含まれる場合、buddhaのoptionは有効(disabled=false)であること", () => {
    render(
      <MonsterThemeSelector member={baseMember()} ownedThemes={["dark", "light", "buddha"]} />,
    );

    const section = screen.getByTestId("monster-theme-section-child-1");
    const select = within(section).getByTestId("monster-theme-select-child-1") as HTMLSelectElement;
    const buddhaOption = getOption(select, "buddha");
    expect(buddhaOption.disabled).toBe(false);
    expect(buddhaOption.textContent).not.toMatch(/準備中/);
  });

  it("ownedThemesにbuddhaが含まれる場合、buddhaを選択するとPATCH APIが呼ばれること", async () => {
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
    const select = within(section).getByTestId("monster-theme-select-child-1") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "buddha" } });

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

  it("ownedThemesにbuddhaが含まれない場合、従来通りbuddhaのoptionは無効(disabled=true)で「準備中」を含むこと（回帰確認）", () => {
    render(<MonsterThemeSelector member={baseMember()} ownedThemes={["dark", "light"]} />);

    const section = screen.getByTestId("monster-theme-section-child-1");
    const select = within(section).getByTestId("monster-theme-select-child-1") as HTMLSelectElement;
    const buddhaOption = getOption(select, "buddha");
    expect(buddhaOption.disabled).toBe(true);
    expect(buddhaOption.textContent).toMatch(/準備中/);
  });

  it("ownedThemesにbuddhaが含まれない場合、buddhaを選択してもPATCH APIが呼ばれないこと（回帰確認）", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ immediate: true, monsterSetId: "buddha" }),
    }) as unknown as typeof fetch;

    render(<MonsterThemeSelector member={baseMember()} ownedThemes={["dark", "light"]} />);

    const section = screen.getByTestId("monster-theme-section-child-1");
    const select = within(section).getByTestId("monster-theme-select-child-1") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "buddha" } });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("境界値: ownedThemesが空配列でも、isFree:trueのテーマ(dark/light)は選択可能であること", () => {
    render(<MonsterThemeSelector member={baseMember()} ownedThemes={[]} />);

    const section = screen.getByTestId("monster-theme-section-child-1");
    const select = within(section).getByTestId("monster-theme-select-child-1") as HTMLSelectElement;
    expect(getOption(select, "dark").disabled).toBe(false);
    expect(getOption(select, "light").disabled).toBe(false);
  });
});

// バグ修正: <select value={currentThemeId}> のため、予約中(pendingMonsterSetId設定済み)でも
// プルダウンには常に現在のテーマ(currentThemeId)が表示されてしまい、
// 予約先と同じ表示になってしまう子は選び直しても onChange が発火しない（値が変わらないため）。
// 修正方針: <select value={pendingThemeId ?? currentThemeId}> にする。
describe("MonsterThemeSelector: 予約中のプルダウン表示値バグ（select value が currentThemeId 固定になっている問題）", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("予約中(pendingMonsterSetId設定済み)の場合、<select>の表示値はcurrentThemeIdではなくpendingThemeIdになること", () => {
    render(
      <MonsterThemeSelector
        member={baseMember({
          evolutionStage: 2,
          rebirthPending: false,
          monsterSetId: "dark",
          pendingMonsterSetId: "light",
        })}
        ownedThemes={["dark", "light", "buddha"]}
      />,
    );

    const section = screen.getByTestId("monster-theme-section-child-1");
    const select = within(section).getByTestId("monster-theme-select-child-1") as HTMLSelectElement;
    // 修正後: pendingThemeId("light")が表示されるべき。現状はcurrentThemeId("dark")のままなので失敗する。
    expect(select.value).toBe("light");
  });

  it("予約中の状態から現在のテーマ(currentThemeIdと同じ値)を選び直すと、onChangeが発火しPATCH APIが呼ばれること（予約の取り消し・変更ができることの確認）", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ immediate: true, monsterSetId: "dark" }),
    }) as unknown as typeof fetch;

    render(
      <MonsterThemeSelector
        member={baseMember({
          evolutionStage: 2,
          rebirthPending: false,
          monsterSetId: "dark",
          pendingMonsterSetId: "light",
        })}
        ownedThemes={["dark", "light", "buddha"]}
      />,
    );

    const section = screen.getByTestId("monster-theme-section-child-1");
    const select = within(section).getByTestId("monster-theme-select-child-1") as HTMLSelectElement;

    // 前提: 修正後はプルダウンに予約先("light")が表示されているはず
    expect(select.value).toBe("light");

    // ユーザーが「現在のテーマ(dark)」を選び直す = 予約を取り消す操作
    fireEvent.change(select, { target: { value: "dark" } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/family/members/child-1/monster-theme",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ themeId: "dark" }),
        }),
      );
    });
  });

  it("予約中の状態から別の未所持でないテーマを選び直すと、PATCH APIが呼ばれ選択表示(pendingThemeId)が新しい値に更新されること", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ immediate: false, pendingMonsterSetId: "buddha" }),
    }) as unknown as typeof fetch;

    render(
      <MonsterThemeSelector
        member={baseMember({
          evolutionStage: 2,
          rebirthPending: false,
          monsterSetId: "dark",
          pendingMonsterSetId: "light",
        })}
        ownedThemes={["dark", "light", "buddha"]}
      />,
    );

    const section = screen.getByTestId("monster-theme-section-child-1");
    const select = within(section).getByTestId("monster-theme-select-child-1") as HTMLSelectElement;

    fireEvent.change(select, { target: { value: "buddha" } });

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
      expect(within(section).getByTestId("monster-theme-pending-child-1").textContent).toMatch(/仏様/);
    });

    // 修正後: プルダウンの表示値も新しいpendingThemeId("buddha")に追従するはず。
    // 現状はcurrentThemeId("dark")に固定されたままなので失敗する。
    expect(select.value).toBe("buddha");
  });

  it("回帰確認: 予約中でない(pendingMonsterSetId===null)場合は、従来通り<select>の表示値がcurrentThemeIdであること", () => {
    render(
      <MonsterThemeSelector
        member={baseMember({
          evolutionStage: 0,
          rebirthPending: false,
          monsterSetId: "dark",
          pendingMonsterSetId: null,
        })}
        ownedThemes={["dark", "light"]}
      />,
    );

    const section = screen.getByTestId("monster-theme-section-child-1");
    const select = within(section).getByTestId("monster-theme-select-child-1") as HTMLSelectElement;
    expect(select.value).toBe("dark");
  });
});
