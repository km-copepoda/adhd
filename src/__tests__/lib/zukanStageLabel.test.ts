import { describe, it, expect } from "vitest";
import { getZukanStageLabel } from "@/lib/zukanStageLabel";

describe("getZukanStageLabel", () => {
  it("パスが1セグメント（第1形態）", () => {
    expect(getZukanStageLabel("STUDY")).toBe("第1形態");
    expect(getZukanStageLabel("STAMINA")).toBe("第1形態");
    expect(getZukanStageLabel("LIFE")).toBe("第1形態");
  });

  it("パスが2セグメント（第2形態）", () => {
    expect(getZukanStageLabel("STUDY_STAMINA")).toBe("第2形態");
    expect(getZukanStageLabel("STAMINA_LIFE")).toBe("第2形態");
  });

  it("パスが3セグメント（第3形態）", () => {
    expect(getZukanStageLabel("STUDY_STAMINA_LIFE")).toBe("第3形態");
    expect(getZukanStageLabel("LIFE_STAMINA_STUDY")).toBe("第3形態");
  });
});
