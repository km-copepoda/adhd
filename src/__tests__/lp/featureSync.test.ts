import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HERO_SUB_TAGS } from "@/lib/lp";

/**
 * LP と実装済み機能の同期を検証するテスト。
 *
 * 実装済みなのに LP に載っていなかった機能:
 *  - チェックイン（src/lib/checkin.ts, CheckinCalendar）
 *  - 今日やる宣言ボーナス（src/lib/declaration.ts, /api/quests/[id]/declare）
 *  - 承認スタンプ（src/lib/stampCelebration.ts, StampCelebrationOverlay）
 */

const SECTIONS_DIR = resolve(__dirname, "../../components/lp");

function read(file: string): string {
  return readFileSync(resolve(SECTIONS_DIR, file), "utf-8");
}

describe("LP feature sync — FeaturesSection", () => {
  const src = read("FeaturesSection.tsx");

  it("チェックイン機能を紹介している", () => {
    expect(src).toContain("チェックイン");
  });

  it("今日やる宣言ボーナスを紹介している", () => {
    expect(src).toContain("宣言");
  });

  it("承認スタンプを紹介している", () => {
    expect(src).toContain("スタンプ");
  });
});

describe("LP feature sync — HabitSection", () => {
  const src = read("HabitSection.tsx");

  it("先延ばし対策として宣言ボーナスに触れている", () => {
    expect(src).toContain("宣言");
  });
});

describe("LP リーチ — 現実ごほうびの前出し", () => {
  it("HERO_SUB_TAGS が現実世界のごほうび（親ごほうび宝箱）に触れている", () => {
    expect(HERO_SUB_TAGS.some((t) => t.includes("ごほうび"))).toBe(true);
  });

  it("TreasureSection が Monsters / Hiroba より前に配置されている", () => {
    const page = readFileSync(
      resolve(__dirname, "../../app/page.tsx"),
      "utf-8",
    );
    const treasure = page.indexOf("<TreasureSection");
    const monsters = page.indexOf("<MonstersSection");
    const hiroba = page.indexOf("<HirobaSection");
    expect(treasure).toBeGreaterThan(0);
    expect(treasure).toBeLessThan(monsters);
    expect(treasure).toBeLessThan(hiroba);
  });
});

describe("LP リーチ — HERO_SUB_TAGS", () => {
  it("ADHD 向け訴求を含む", () => {
    expect(HERO_SUB_TAGS.some((t) => t.includes("ADHD"))).toBe(true);
  });

  it("一般家庭向け訴求を含む（ADHD 限定アプリに見えないように）", () => {
    expect(
      HERO_SUB_TAGS.some((t) => /一般|ふつう|どんな子/.test(t)),
    ).toBe(true);
  });

  it("具体的な生活シーン（宿題・したく等）で親に刺さる文言を含む", () => {
    expect(
      HERO_SUB_TAGS.some((t) => /宿題|したく|支度|お手伝い/.test(t)),
    ).toBe(true);
  });
});
