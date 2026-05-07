import { describe, it, expect } from "vitest";
import {
  PAIN_POINTS,
  BEFORE_AFTER,
  FAQ_ITEMS,
  HERO_SUB_TAGS,
  HIROBA_FEATURES,
  CHEER_FEATURE,
  HIROBA_PRIVACY_NOTES,
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
