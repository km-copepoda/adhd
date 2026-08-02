import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  TREASURE_FEATURE,
  COLLECTION_FEATURE,
  TREASURE_FAQ_ITEMS,
} from "@/lib/lp";

const TREASURE_SECTION_PATH = resolve(
  __dirname,
  "../../components/lp/TreasureSection.tsx",
);
const FEATURES_PATH = resolve(
  __dirname,
  "../../components/lp/FeaturesSection.tsx",
);
const HOW_IT_WORKS_PATH = resolve(
  __dirname,
  "../../components/lp/HowItWorksSection.tsx",
);
const MONSTERS_PATH = resolve(
  __dirname,
  "../../components/lp/MonstersSection.tsx",
);
const FAQ_PATH = resolve(__dirname, "../../components/lp/FaqSection.tsx");
const BEFORE_AFTER_PATH = resolve(
  __dirname,
  "../../components/lp/BeforeAfterSection.tsx",
);
const SCREENS_PATH = resolve(__dirname, "../../components/lp/ScreensSection.tsx");
const PAGE_PATH = resolve(__dirname, "../../app/page.tsx");

describe("LP TREASURE & COLLECTION data", () => {
  it("TREASURE_FEATURE が必要なフィールドを持つ", () => {
    expect(TREASURE_FEATURE.title.length).toBeGreaterThan(0);
    expect(TREASURE_FEATURE.subTitle.length).toBeGreaterThan(0);
    expect(TREASURE_FEATURE.body.length).toBeGreaterThan(0);
    expect(TREASURE_FEATURE.bullets.length).toBeGreaterThanOrEqual(4);
  });

  it("TREASURE_FEATURE.bullets に親ごほうび・コレクション・boost(全完了) への言及がある", () => {
    const joined = TREASURE_FEATURE.bullets.join(" / ");
    expect(joined).toMatch(/親ごほうび|ごほうび/);
    expect(joined).toMatch(/コレクション|アイテム/);
    expect(joined).toMatch(/全(部|タスク)?完了|オールクリア|全クリア/);
  });

  // 2026-07-22 で月限定 60 種 (12ヶ月 × 5) が追加され、通常 80 + 月限定 60 = 140 になった。
  // LP の COLLECTION_FEATURE も 140 種と「今月しか出ない」訴求を含む必要がある。
  it("COLLECTION_FEATURE が通常80種と月限定60種で合計140種に言及する", () => {
    expect(COLLECTION_FEATURE.title.length).toBeGreaterThan(0);
    expect(COLLECTION_FEATURE.body).toMatch(/140/);
    expect(COLLECTION_FEATURE.body).toMatch(/80/);
    expect(COLLECTION_FEATURE.body).toMatch(/60/);
    expect(COLLECTION_FEATURE.body).toMatch(/春|夏|秋|冬|シーズン/);
    // 「月限定」または「今月しか」で毎月の再訪動機を訴求している
    const joined = `${COLLECTION_FEATURE.subTitle} ${COLLECTION_FEATURE.body} ${COLLECTION_FEATURE.bullets.join(" ")}`;
    expect(joined).toMatch(/月限定|今月|月げんてい/);
  });

  it("TREASURE_FAQ_ITEMS が 2 件以上ある / 月限定への言及がある", () => {
    expect(TREASURE_FAQ_ITEMS.length).toBeGreaterThanOrEqual(2);
    for (const q of TREASURE_FAQ_ITEMS) {
      expect(q.question.length).toBeGreaterThan(0);
      expect(q.answer.length).toBeGreaterThan(0);
    }
    const joinedAnswers = TREASURE_FAQ_ITEMS.map((f) => f.answer).join(" ");
    expect(joinedAnswers).toMatch(/月限定|今月|月げんてい/);
  });
});

describe("LP TreasureSection.tsx", () => {
  const src = readFileSync(TREASURE_SECTION_PATH, "utf-8");

  it("TreasureSection という export がある", () => {
    expect(src).toMatch(/export function TreasureSection/);
  });

  it("TREASURE_FEATURE と COLLECTION_FEATURE を参照している", () => {
    expect(src).toContain("TREASURE_FEATURE");
    expect(src).toContain("COLLECTION_FEATURE");
  });

  it("見出しに「TREASURE & COLLECTION」を含む", () => {
    expect(src).toContain("TREASURE");
    expect(src).toContain("COLLECTION");
  });
});

describe("LP FeaturesSection.tsx — 宝箱・コレクションの追加カード", () => {
  const src = readFileSync(FEATURES_PATH, "utf-8");

  it("「ごほうび宝箱」カードを含む", () => {
    expect(src).toMatch(/宝箱|ごほうび/);
    expect(src).toMatch(/TREASURE/);
  });

  it("「季節コレクション」カードを含む", () => {
    expect(src).toMatch(/コレクション|季節/);
    expect(src).toMatch(/COLLECTION/);
  });
});

describe("LP HowItWorksSection.tsx — 文言の実装追従", () => {
  const src = readFileSync(HOW_IT_WORKS_PATH, "utf-8");

  it("step04 で「宝箱」または「コレクション」に言及している", () => {
    expect(src).toMatch(/宝箱|コレクション/);
  });

  it("「全79種」という誤った断定的表記が単独で残っていない", () => {
    // 「全79種コレクション」が紛らわしいので、別表現に置き換わっているか
    expect(src).not.toMatch(/全79種コレクション/);
  });
});

describe("LP MonstersSection.tsx — 数値表現の整合", () => {
  const src = readFileSync(MONSTERS_PATH, "utf-8");

  it("MONSTER COLLECTION 見出しは残っている", () => {
    expect(src).toContain("MONSTER COLLECTION");
  });

  it("モンスターの正しいカウント根拠 (3 + 9 + 27) が記載されている", () => {
    expect(src).toContain("3");
    expect(src).toContain("9");
    expect(src).toContain("27");
  });
});

describe("LP FaqSection.tsx — 宝箱関連QAの追加", () => {
  const src = readFileSync(FAQ_PATH, "utf-8");

  it("TREASURE_FAQ_ITEMS を参照している", () => {
    expect(src).toContain("TREASURE_FAQ_ITEMS");
  });
});

describe("LP BeforeAfterSection.tsx — 宝箱への言及", () => {
  // BEFORE_AFTER データは src/lib/lp.ts 由来。データの中に宝箱に類する語があること
  // をデータ側で検証する
  const lpSrc = readFileSync(
    resolve(__dirname, "../../lib/lp.ts"),
    "utf-8",
  );

  it("BEFORE_AFTER に「宝箱」または「ごほうび宝箱」の文言を含む", () => {
    expect(lpSrc).toMatch(/宝箱/);
  });

  // BEFORE_AFTER の存在 (sanity)
  it("BeforeAfterSection は BEFORE_AFTER を参照したまま", () => {
    const src = readFileSync(BEFORE_AFTER_PATH, "utf-8");
    expect(src).toContain("BEFORE_AFTER");
  });
});

describe("LP ScreensSection.tsx — 宝箱・コレクションのスクリーン追加", () => {
  const src = readFileSync(SCREENS_PATH, "utf-8");

  it("「💎 子ども — 宝箱」ラベルを含む", () => {
    expect(src).toContain("💎 子ども — 宝箱");
  });

  it("「📦 子ども — コレクション図鑑」ラベルを含む", () => {
    expect(src).toContain("📦 子ども — コレクション図鑑");
  });
});

describe("LP page.tsx — TreasureSection を組み込んでいる", () => {
  const src = readFileSync(PAGE_PATH, "utf-8");

  it("TreasureSection を import している", () => {
    expect(src).toMatch(/import\s*\{\s*TreasureSection\s*\}\s*from\s*"@\/components\/lp\/TreasureSection"/);
  });

  it("TreasureSection を render している", () => {
    expect(src).toMatch(/<TreasureSection\s/);
  });

  it("nav に宝箱セクションへのアンカーがある", () => {
    expect(src).toMatch(/#treasure/);
  });
});
