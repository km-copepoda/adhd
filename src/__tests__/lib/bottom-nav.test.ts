import { shouldShowBottomNav } from "@/lib/bottom-nav";

describe("shouldShowBottomNav", () => {
  it("onboarding ページでは false を返す", () => {
    expect(shouldShowBottomNav("/child/onboarding")).toBe(false);
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
