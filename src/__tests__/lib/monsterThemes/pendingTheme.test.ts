import { describe, it, expect } from "vitest";
import { buildRebirthThemeUpdate } from "@/lib/monsterThemes/pendingTheme";

describe("buildRebirthThemeUpdate", () => {
  it("予約テーマがあれば monsterSetId に反映して pendingMonsterSetId を null にする", () => {
    expect(buildRebirthThemeUpdate("yokai")).toEqual({
      monsterSetId: "yokai",
      pendingMonsterSetId: null,
    });
  });

  it("null の場合は空オブジェクト（何も変更しない）", () => {
    expect(buildRebirthThemeUpdate(null)).toEqual({});
  });

  it("undefined の場合は空オブジェクト", () => {
    expect(buildRebirthThemeUpdate(undefined)).toEqual({});
  });

  it("空文字の場合は空オブジェクト", () => {
    expect(buildRebirthThemeUpdate("")).toEqual({});
  });
});
