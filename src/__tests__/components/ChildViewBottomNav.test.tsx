// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/parent/child-view/child-1/quests",
}));

import ChildViewBottomNav from "@/components/parent/ChildViewBottomNav";

describe("ChildViewBottomNav", () => {
  it("クエスト・育成・ひろば の3タブが指定した childId にリンクする", () => {
    render(<ChildViewBottomNav childId="child-1" />);
    expect(screen.getByRole("link", { name: /クエスト/ }).getAttribute("href"))
      .toBe("/app/parent/child-view/child-1/quests");
    expect(screen.getByRole("link", { name: /育成/ }).getAttribute("href"))
      .toBe("/app/parent/child-view/child-1/monster");
    expect(screen.getByRole("link", { name: /ひろば/ }).getAttribute("href"))
      .toBe("/app/parent/child-view/child-1/gathering");
  });

  it("「子を切替」リンクが子供セレクター画面に戻る", () => {
    render(<ChildViewBottomNav childId="child-1" />);
    expect(screen.getByRole("link", { name: /子を切替/ }).getAttribute("href"))
      .toBe("/app/parent/child-view");
  });

  it("「親画面」リンクで親管理画面（タスク管理）に戻れる", () => {
    render(<ChildViewBottomNav childId="child-1" />);
    expect(screen.getByRole("link", { name: /親画面/ }).getAttribute("href"))
      .toBe("/app/parent/tasks");
  });
});
