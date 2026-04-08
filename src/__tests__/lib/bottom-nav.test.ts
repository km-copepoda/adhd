import { shouldShowBottomNav } from "@/lib/bottom-nav";

describe("shouldShowBottomNav", () => {
  it("app/child/login ページでは false を返す", () => {
    expect(shouldShowBottomNav("/app/child/login")).toBe(false);
  });

  it("app/child/quests ページでは true を返す", () => {
    expect(shouldShowBottomNav("/app/child/quests")).toBe(true);
  });

  it("app/child/monster ページでは true を返す", () => {
    expect(shouldShowBottomNav("/app/child/monster")).toBe(true);
  });

  it("app/child/zukan ページでは true を返す", () => {
    expect(shouldShowBottomNav("/app/child/zukan")).toBe(true);
  });
});
