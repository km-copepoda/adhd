import { shouldShowBottomNav } from "@/lib/bottom-nav";

describe("shouldShowBottomNav", () => {
  it("child/login ページでは false を返す", () => {
    expect(shouldShowBottomNav("/child/login")).toBe(false);
  });

  it("quests ページでは true を返す", () => {
    expect(shouldShowBottomNav("/child/quests")).toBe(true);
  });

  it("monster ページでは true を返す", () => {
    expect(shouldShowBottomNav("/child/monster")).toBe(true);
  });

  it("zukan ページでは true を返す", () => {
    expect(shouldShowBottomNav("/child/zukan")).toBe(true);
  });
});
