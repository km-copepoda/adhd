// @vitest-environment jsdom
//
// Issue #262: MonsterThemeSelector の onThemeChanged コールバック
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import MonsterThemeSelector, { type ThemeChangedResult } from "@/components/parent/MonsterThemeSelector";

const member = {
  id: "child-1",
  evolutionStage: 1,
  rebirthPending: false,
  monsterSetId: "dark",
  pendingMonsterSetId: null,
};
const owned = ["dark", "light", "railway"];

function mockPatch(impl: () => Promise<unknown>) {
  global.fetch = vi.fn().mockImplementation(impl) as unknown as typeof fetch;
}

function renderSelector(onThemeChanged: (result: ThemeChangedResult) => void) {
  render(
    <MonsterThemeSelector member={member} ownedThemes={owned} onThemeChanged={onThemeChanged} />
  );
  return screen.getByTestId("monster-theme-select-child-1") as HTMLSelectElement;
}

afterEach(() => vi.clearAllMocks());

describe("MonsterThemeSelector onThemeChanged（Issue #262）", () => {
  it("即時変更の成功時、{ immediate: true, monsterSetId } で1回呼ばれる", async () => {
    mockPatch(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ immediate: true, monsterSetId: "railway" }) })
    );
    const cb = vi.fn();
    const select = renderSelector(cb);
    fireEvent.change(select, { target: { value: "railway" } });
    await waitFor(() => expect(cb).toHaveBeenCalledTimes(1));
    expect(cb).toHaveBeenCalledWith({ immediate: true, monsterSetId: "railway" });
  });

  it("予約の成功時、{ immediate: false, pendingMonsterSetId } で1回呼ばれる", async () => {
    mockPatch(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ immediate: false, pendingMonsterSetId: "railway" }),
      })
    );
    const cb = vi.fn();
    const select = renderSelector(cb);
    fireEvent.change(select, { target: { value: "railway" } });
    await waitFor(() => expect(cb).toHaveBeenCalledTimes(1));
    expect(cb).toHaveBeenCalledWith({ immediate: false, pendingMonsterSetId: "railway" });
  });

  it("API が ok:false を返した場合は呼ばれない", async () => {
    mockPatch(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: "NG" }) }));
    const cb = vi.fn();
    const select = renderSelector(cb);
    fireEvent.change(select, { target: { value: "railway" } });
    await screen.findByText("NG");
    expect(cb).not.toHaveBeenCalled();
  });

  it("通信エラー時は呼ばれない", async () => {
    mockPatch(() => Promise.reject(new Error("network")));
    const cb = vi.fn();
    const select = renderSelector(cb);
    fireEvent.change(select, { target: { value: "railway" } });
    await screen.findByText("通信エラーが発生しました");
    expect(cb).not.toHaveBeenCalled();
  });

  it("onThemeChanged 未指定でも従来どおり成功メッセージが出る", async () => {
    mockPatch(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve({ immediate: true, monsterSetId: "light" }) })
    );
    render(<MonsterThemeSelector member={member} ownedThemes={owned} />);
    fireEvent.change(screen.getByTestId("monster-theme-select-child-1"), { target: { value: "light" } });
    await screen.findByText("テーマを変更しました");
  });
});
