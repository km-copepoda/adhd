import { describe, it, expect } from "vitest";
import { getCheckinPillLabel } from "@/lib/checkinPill";

describe("getCheckinPillLabel", () => {
  it("enabled: false のときは null（ピル非表示）を返す", () => {
    const r = getCheckinPillLabel({
      enabled: false,
      todayStatus: "pending",
      currentStreak: 0,
    });
    expect(r).toBeNull();
  });

  it("todayStatus: success / currentStreak: 5 → 連続日数と『今日チェックイン済み』相当の文言を含む", () => {
    const r = getCheckinPillLabel({
      enabled: true,
      todayStatus: "success",
      currentStreak: 5,
    });
    expect(r).not.toBeNull();
    expect(r).toContain("🔥 5日連続");
    // 「今日チェックイン済み」相当（済み表現を含む）
    expect(r).toMatch(/チェックイン済み/);
  });

  it("currentStreak: 1 → 『今日から連続スタート』系の文言（CheckinSuccessCutsceneと口調・境界を揃える）", () => {
    const r = getCheckinPillLabel({
      enabled: true,
      todayStatus: "success",
      currentStreak: 1,
    });
    expect(r).not.toBeNull();
    expect(r).toMatch(/連続スタート/);
    // 1日連続、という数値表現は使わない（CheckinSuccessCutsceneの出し分けと一致させる）
    expect(r).not.toContain("1日連続");
  });

  it("境界値 currentStreak: 0 かつ todayStatus: success（防御的ケース）→ 🔥 0日連続 を出さない", () => {
    const r = getCheckinPillLabel({
      enabled: true,
      todayStatus: "success",
      currentStreak: 0,
    });
    expect(r).not.toBeNull();
    expect(r).not.toContain("🔥 0日連続");
  });

  it("todayStatus: fail（締切超過）→ 叱責にならない文言を返し、🔥 0日連続 を出さない", () => {
    const r = getCheckinPillLabel({
      enabled: true,
      todayStatus: "fail",
      currentStreak: 0,
    });
    expect(r).not.toBeNull();
    expect(r).not.toContain("🔥 0日連続");
    // 敬語・叱責ワードを含まない（トンマナ規約: カジュアルで励ます口調）
    expect(r).not.toMatch(/だめ|サボ|失敗しました|できませんでした/);
  });

  it("境界値 currentStreak: 999（3桁）でも文言が生成される", () => {
    const r = getCheckinPillLabel({
      enabled: true,
      todayStatus: "success",
      currentStreak: 999,
    });
    expect(r).not.toBeNull();
    expect(r).toContain("999日連続");
  });
});
