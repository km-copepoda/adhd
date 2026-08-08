import { describe, it, expect } from "vitest";
import {
  PAIN_POINTS,
  BEFORE_AFTER,
  FAQ_ITEMS,
  HERO_SUB_TAGS,
  HIROBA_FEATURES,
  CHEER_FEATURE,
  HIROBA_PRIVACY_NOTES,
  PSYCHOLOGY_INSIGHTS,
} from "@/lib/lp";

describe("PAIN_POINTS — 親の悩みリスト", () => {
  it("少なくとも6項目ある", () => {
    expect(PAIN_POINTS.length).toBeGreaterThanOrEqual(6);
  });

  it("各項目に icon, title, body を持つ", () => {
    for (const p of PAIN_POINTS) {
      expect(p.icon, `title=${p.title} に icon が無い`).toBeTruthy();
      expect(p.title, `icon=${p.icon} に title が無い`).toBeTruthy();
      expect(p.body, `title=${p.title} に body が無い`).toBeTruthy();
    }
  });

  it("title はすべてユニーク", () => {
    const titles = PAIN_POINTS.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("ADHD の親が共感する具体悩みを含む", () => {
    const joined = PAIN_POINTS.map((p) => `${p.title}\n${p.body}`).join("\n");
    // 「ワーキングメモリ／忘れ物」「先延ばし／動き出し」「叱る／自己肯定感」のいずれかにヒットすべき
    expect(joined).toMatch(/忘れ|やること|何度|散らかし/);
    expect(joined).toMatch(/動き出|先延ば|始め|やる気/);
    expect(joined).toMatch(/叱|自己肯定|怒|否定/);
  });
});

describe("BEFORE_AFTER — 使用前後の変化", () => {
  it("少なくとも4項目ある", () => {
    expect(BEFORE_AFTER.length).toBeGreaterThanOrEqual(4);
  });

  it("各項目に scene, before, after を持つ", () => {
    for (const ba of BEFORE_AFTER) {
      expect(ba.scene, "scene が無い").toBeTruthy();
      expect(ba.before, `scene=${ba.scene} に before が無い`).toBeTruthy();
      expect(ba.after, `scene=${ba.scene} に after が無い`).toBeTruthy();
    }
  });

  it("scene はユニーク", () => {
    const scenes = BEFORE_AFTER.map((ba) => ba.scene);
    expect(new Set(scenes).size).toBe(scenes.length);
  });
});

describe("FAQ_ITEMS — よくある質問", () => {
  it("少なくとも5項目ある", () => {
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(5);
  });

  it("各項目に question, answer を持つ", () => {
    for (const f of FAQ_ITEMS) {
      expect(f.question, "question が無い").toBeTruthy();
      expect(f.answer, `question=${f.question} に answer が無い`).toBeTruthy();
    }
  });

  it("question はユニーク", () => {
    const qs = FAQ_ITEMS.map((f) => f.question);
    expect(new Set(qs).size).toBe(qs.length);
  });

  it("ADHD・ご褒美依存・ゲーム依存・年齢のいずれかに言及している", () => {
    const joined = FAQ_ITEMS.map((f) => `${f.question}\n${f.answer}`).join("\n");
    expect(joined).toMatch(/ADHD/);
    expect(joined).toMatch(/ご褒美|外発|報酬/);
    expect(joined).toMatch(/ゲーム|依存|長時間|スクリーン/);
    expect(joined).toMatch(/年齢|歳|何歳/);
  });
});

describe("HERO_SUB_TAGS — ヒーローのサブバッジ", () => {
  it("少なくとも3個ある", () => {
    expect(HERO_SUB_TAGS.length).toBeGreaterThanOrEqual(3);
  });

  it("ADHD への言及を含む", () => {
    const joined = HERO_SUB_TAGS.join(" ");
    expect(joined).toMatch(/ADHD|集中|動き出/);
  });
});

describe("HIROBA_FEATURES — ひろば機能の特徴カード", () => {
  it("少なくとも3項目ある", () => {
    expect(HIROBA_FEATURES.length).toBeGreaterThanOrEqual(3);
  });

  it("各項目に icon, title, body を持つ", () => {
    for (const f of HIROBA_FEATURES) {
      expect(f.icon, `title=${f.title} に icon が無い`).toBeTruthy();
      expect(f.title, `icon=${f.icon} に title が無い`).toBeTruthy();
      expect(f.body, `title=${f.title} に body が無い`).toBeTruthy();
    }
  });

  it("title はすべてユニーク", () => {
    const titles = HIROBA_FEATURES.map((f) => f.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("「場所×合言葉」「自動掲示板」「リアルタイム」のいずれかに言及している", () => {
    const joined = HIROBA_FEATURES.map((f) => `${f.title}\n${f.body}`).join("\n");
    expect(joined).toMatch(/合言葉|あいことば|場所|公園|児童館|校庭/);
    expect(joined).toMatch(/掲示板|自動|投稿/);
    expect(joined).toMatch(/リアルタイム|なかま|社会|応援/);
  });
});

describe("CHEER_FEATURE — エール（応援スタンプ）", () => {
  it("title と subTitle, body を持つ", () => {
    expect(CHEER_FEATURE.title).toBeTruthy();
    expect(CHEER_FEATURE.subTitle).toBeTruthy();
    expect(CHEER_FEATURE.body).toBeTruthy();
    expect(CHEER_FEATURE.icon).toBeTruthy();
  });

  it("仕様の核（1日1回・進捗別メッセージ・自由文なし）に触れている", () => {
    const joined = `${CHEER_FEATURE.title} ${CHEER_FEATURE.subTitle} ${CHEER_FEATURE.body} ${CHEER_FEATURE.bullets.join(" ")}`;
    expect(joined).toMatch(/1日1回|一日1回|1日に1回/);
    expect(joined).toMatch(/進捗|状況|状態|まだ|途中|完了/);
    expect(joined).toMatch(/自由文|プリセット|定型|文章/);
  });

  it("3〜6個の特徴 bullets を持つ", () => {
    expect(CHEER_FEATURE.bullets.length).toBeGreaterThanOrEqual(3);
    expect(CHEER_FEATURE.bullets.length).toBeLessThanOrEqual(6);
  });
});

describe("HIROBA_PRIVACY_NOTES — プライバシー保護の注意点", () => {
  it("少なくとも3項目ある", () => {
    expect(HIROBA_PRIVACY_NOTES.length).toBeGreaterThanOrEqual(3);
  });

  it("「タスク名を載せない」「自由文不可」「直近4日のみ」「個人特定不可」のいずれかに言及している", () => {
    const joined = HIROBA_PRIVACY_NOTES.join("\n");
    expect(joined).toMatch(/タスク名|内容|具体/);
    expect(joined).toMatch(/自由文|定型|プリセット|書き込/);
    expect(joined).toMatch(/4日|四日|短期|消える|残らない/);
  });
});

describe("FAQ_ITEMS — ひろば／エールへの言及", () => {
  it("ひろば機能・自由文不可・他人交流の安心感に触れる項目がある", () => {
    const joined = FAQ_ITEMS.map((f) => `${f.question}\n${f.answer}`).join("\n");
    expect(joined).toMatch(/ひろば|エール|なかま|他のお子さん|他の子/);
    expect(joined).toMatch(/自由文|定型|プリセット|書き込/);
  });
});

describe("PSYCHOLOGY_INSIGHTS — 行動心理学に基づく設計の解説", () => {
  it("ちょうど 5 項目ある（宝箱／チェックイン／自動承認／宣言／スキップ）", () => {
    expect(PSYCHOLOGY_INSIGHTS.length).toBe(5);
  });

  it("各項目に icon, headline, body, feature, theory を持つ", () => {
    for (const p of PSYCHOLOGY_INSIGHTS) {
      expect(p.icon, `headline=${p.headline} に icon が無い`).toBeTruthy();
      expect(p.headline, "headline が無い").toBeTruthy();
      expect(p.body, `headline=${p.headline} に body が無い`).toBeTruthy();
      expect(p.feature, `headline=${p.headline} に feature が無い`).toBeTruthy();
      expect(p.theory, `headline=${p.headline} に theory が無い`).toBeTruthy();
    }
  });

  it("headline はすべてユニーク", () => {
    const headlines = PSYCHOLOGY_INSIGHTS.map((p) => p.headline);
    expect(new Set(headlines).size).toBe(headlines.length);
  });

  it("body は日常語で書かれ、専門用語（オペラント・変動強化・Fogg 等）は headline/body に露出させない", () => {
    // 見出し・本文には理論名を出さず、平易な日常語で説明する方針
    const joined = PSYCHOLOGY_INSIGHTS.map((p) => `${p.headline}\n${p.body}`).join("\n");
    expect(joined).not.toMatch(/オペラント|変動強化スケジュール|Fogg|What-the-hell|事前コミットメント/i);
  });

  it("theory 欄には根拠となる心理学理論名が入っている", () => {
    const joined = PSYCHOLOGY_INSIGHTS.map((p) => p.theory).join("\n");
    // 5 つの中に少なくともこれらの理論名が現れる
    expect(joined).toMatch(/変動強化|オペラント/);
    expect(joined).toMatch(/Fogg|行動モデル/);
    expect(joined).toMatch(/消去/);
    expect(joined).toMatch(/コミットメント|一貫性/);
    expect(joined).toMatch(/損失回避|What-the-hell|どうにでもなれ/i);
  });

  it("5 つの実装済み機能が漏れなくカバーされている", () => {
    const features = PSYCHOLOGY_INSIGHTS.map((p) => p.feature).join("\n");
    expect(features).toMatch(/宝箱|天井|ピティ|ガチャ/); // 変動強化＋天井
    expect(features).toMatch(/チェックイン/);
    expect(features).toMatch(/自動承認/);
    expect(features).toMatch(/宣言/);
    expect(features).toMatch(/スキップ/);
  });

  it("宝箱項目は「10回」または「天井」に言及して安全設計を伝えている", () => {
    const treasure = PSYCHOLOGY_INSIGHTS.find(
      (p) => /宝箱|天井|ピティ|ガチャ/.test(p.feature)
    );
    expect(treasure, "宝箱に関する項目が見つからない").toBeTruthy();
    expect(`${treasure!.headline}\n${treasure!.body}`).toMatch(/10|天井|必ず|保証/);
  });

  it("自動承認項目は「翌日」または「0時」に言及して現行仕様と整合する", () => {
    const auto = PSYCHOLOGY_INSIGHTS.find((p) => /自動承認/.test(p.feature));
    expect(auto, "自動承認に関する項目が見つからない").toBeTruthy();
    expect(`${auto!.headline}\n${auto!.body}`).toMatch(/翌日|0時|翌0時|自動/);
  });
});
