import { describe, it, expect } from "vitest";
import {
  normalizeSecretWord,
  buildBulletinMessage,
  getProgressMilestones,
  getBulletinLogEmoji,
  groupBulletinLogsByDate,
  formatBulletinDateHeading,
  LOCATION_CAPACITY,
} from "@/lib/gathering";

// ─── normalizeSecretWord ──────────────────────────────────────────────────────
describe("normalizeSecretWord", () => {
  it("ひらがなをカタカナに変換する", () => {
    expect(normalizeSecretWord("ぱーく")).toBe("パーク");
  });

  it("英字を大文字に変換する", () => {
    expect(normalizeSecretWord("park")).toBe("PARK");
  });

  it("混在（ひらがな+英字）を正規化する", () => {
    expect(normalizeSecretWord("れいんbow")).toBe("レインBOW");
  });

  it("10文字を超えた場合は切り捨てる", () => {
    const result = normalizeSecretWord("あいうえおかきくけこさ");
    expect(result.length).toBe(10);
    expect(result).toBe("アイウエオカキクケコ");
  });

  it("前後の空白をトリムする", () => {
    expect(normalizeSecretWord("  ぱーく  ")).toBe("パーク");
  });

  it("カタカナはそのまま維持する", () => {
    expect(normalizeSecretWord("パーク")).toBe("パーク");
  });

  it("空文字列を返す", () => {
    expect(normalizeSecretWord("")).toBe("");
  });

  it("空白のみは空文字列になる", () => {
    expect(normalizeSecretWord("   ")).toBe("");
  });
});

// ─── LOCATION_CAPACITY ───────────────────────────────────────────────────────
describe("LOCATION_CAPACITY", () => {
  it("公園は10人", () => { expect(LOCATION_CAPACITY.PARK).toBe(10); });
  it("児童館は30人", () => { expect(LOCATION_CAPACITY.COMMUNITY_CENTER).toBe(30); });
  it("校庭は50人", () => { expect(LOCATION_CAPACITY.SCHOOL).toBe(50); });
});

// ─── getProgressMilestones ────────────────────────────────────────────────────
describe("getProgressMilestones", () => {
  it("0件完了時は空配列", () => {
    expect(getProgressMilestones(0, 4)).toEqual([]);
  });

  it("total=0時は空配列", () => {
    expect(getProgressMilestones(0, 0)).toEqual([]);
  });

  it("1件完了（1/4=25%）: TASK_STARTED + TASK_PROGRESS_25", () => {
    const m = getProgressMilestones(1, 4);
    expect(m).toContain("TASK_STARTED");
    expect(m).toContain("TASK_PROGRESS_25");
    expect(m).not.toContain("TASK_PROGRESS_50");
  });

  it("2件完了（2/4=50%）: 25%と50%を含む", () => {
    const m = getProgressMilestones(2, 4);
    expect(m).toContain("TASK_PROGRESS_25");
    expect(m).toContain("TASK_PROGRESS_50");
    expect(m).not.toContain("TASK_PROGRESS_75");
  });

  it("3件完了（3/4=75%）: 75%を含む", () => {
    const m = getProgressMilestones(3, 4);
    expect(m).toContain("TASK_PROGRESS_75");
    expect(m).not.toContain("TASK_COMPLETE");
  });

  it("4件完了（4/4=100%）: 全マイルストーンを含む", () => {
    const m = getProgressMilestones(4, 4);
    expect(m).toContain("TASK_STARTED");
    expect(m).toContain("TASK_PROGRESS_25");
    expect(m).toContain("TASK_PROGRESS_50");
    expect(m).toContain("TASK_PROGRESS_75");
    expect(m).toContain("TASK_COMPLETE");
  });

  it("1/1=100%でも全マイルストーンが発火する", () => {
    const m = getProgressMilestones(1, 1);
    expect(m).toContain("TASK_STARTED");
    expect(m).toContain("TASK_COMPLETE");
  });

  it("境界値: 1/4=25%ちょうどでTASK_PROGRESS_25が発火する", () => {
    expect(getProgressMilestones(1, 4)).toContain("TASK_PROGRESS_25");
  });

  it("境界値: done/total が25%未満（1/5=20%）は25%発火しない", () => {
    const m = getProgressMilestones(1, 5);
    expect(m).toContain("TASK_STARTED");
    expect(m).not.toContain("TASK_PROGRESS_25");
  });
});

// ─── buildBulletinMessage ─────────────────────────────────────────────────────
describe("buildBulletinMessage", () => {
  it("TASK_STARTED: 名前を含むメッセージを返す", () => {
    const msg = buildBulletinMessage("TASK_STARTED", "たろう");
    expect(msg).toContain("たろう");
    expect(msg).toContain("スタート");
  });

  it("TASK_PROGRESS_25: 頑張っているメッセージ", () => {
    const msg = buildBulletinMessage("TASK_PROGRESS_25", "はなこ");
    expect(msg).toContain("はなこ");
    expect(msg).toContain("頑張");
  });

  it("TASK_PROGRESS_50: 夢中メッセージ", () => {
    const msg = buildBulletinMessage("TASK_PROGRESS_50", "けんた");
    expect(msg).toContain("夢中");
  });

  it("TASK_PROGRESS_75: もうすぐメッセージ", () => {
    const msg = buildBulletinMessage("TASK_PROGRESS_75", "さくら");
    expect(msg).toContain("もうすぐ");
  });

  it("TASK_COMPLETE: やりとげたメッセージ", () => {
    const msg = buildBulletinMessage("TASK_COMPLETE", "りく");
    expect(msg).toContain("やりとげた");
  });

  it("BADGE_UNLOCKED: バッジ名を含む", () => {
    const msg = buildBulletinMessage("BADGE_UNLOCKED", "あおい", "はじめの一歩");
    expect(msg).toContain("はじめの一歩");
    expect(msg).toContain("バッジ");
  });

  it("STREAK_TITLE: 称号名を含む", () => {
    const msg = buildBulletinMessage("STREAK_TITLE", "ゆい", "一週間の戦士");
    expect(msg).toContain("一週間の戦士");
    expect(msg).toContain("称号");
  });

  it("MONSTER_EVOLVED: モンスター名を含む", () => {
    const msg = buildBulletinMessage("MONSTER_EVOLVED", "こうた", "フレアドラゴン");
    expect(msg).toContain("フレアドラゴン");
    expect(msg).toContain("進化");
  });

  it("MONSTER_REBORN: 転生メッセージ", () => {
    const msg = buildBulletinMessage("MONSTER_REBORN", "みな", "べんきょう");
    expect(msg).toContain("べんきょう");
    expect(msg).toContain("転生");
  });

  it("不明なtypeは空文字を返す", () => {
    expect(buildBulletinMessage("UNKNOWN_TYPE", "だれか")).toBe("");
  });
});

// ─── getBulletinLogEmoji ──────────────────────────────────────────────────────
describe("getBulletinLogEmoji", () => {
  it("TASK_* は種類ごとに別の絵文字を返す（重複なし）", () => {
    const emojis = [
      getBulletinLogEmoji("TASK_STARTED"),
      getBulletinLogEmoji("TASK_PROGRESS_25"),
      getBulletinLogEmoji("TASK_PROGRESS_50"),
      getBulletinLogEmoji("TASK_PROGRESS_75"),
      getBulletinLogEmoji("TASK_COMPLETE"),
    ];
    expect(new Set(emojis).size).toBe(5);
    // ⚔️ 一色だった旧仕様には戻さない
    expect(emojis).not.toContain("⚔️");
  });

  it("TASK_STARTED → 🚀（スタート）", () => {
    expect(getBulletinLogEmoji("TASK_STARTED")).toBe("🚀");
  });

  it("TASK_PROGRESS_25 → 🌱", () => {
    expect(getBulletinLogEmoji("TASK_PROGRESS_25")).toBe("🌱");
  });

  it("TASK_PROGRESS_50 → 💪", () => {
    expect(getBulletinLogEmoji("TASK_PROGRESS_50")).toBe("💪");
  });

  it("TASK_PROGRESS_75 → ⚡", () => {
    expect(getBulletinLogEmoji("TASK_PROGRESS_75")).toBe("⚡");
  });

  it("TASK_COMPLETE → 🎉", () => {
    expect(getBulletinLogEmoji("TASK_COMPLETE")).toBe("🎉");
  });

  it("BADGE_UNLOCKED → 🏅", () => {
    expect(getBulletinLogEmoji("BADGE_UNLOCKED")).toBe("🏅");
  });

  it("STREAK_TITLE → 👑（称号は王冠）", () => {
    expect(getBulletinLogEmoji("STREAK_TITLE")).toBe("👑");
  });

  it("MONSTER_EVOLVED → 🌟", () => {
    expect(getBulletinLogEmoji("MONSTER_EVOLVED")).toBe("🌟");
  });

  it("MONSTER_REBORN → 🐣", () => {
    expect(getBulletinLogEmoji("MONSTER_REBORN")).toBe("🐣");
  });

  it("不明なtypeはデフォルト絵文字を返す", () => {
    const emoji = getBulletinLogEmoji("UNKNOWN_TYPE");
    expect(typeof emoji).toBe("string");
    expect(emoji.length).toBeGreaterThan(0);
  });
});

// ─── groupBulletinLogsByDate ──────────────────────────────────────────────────
describe("groupBulletinLogsByDate", () => {
  it("同じ日のログをまとめる（日付降順 → ログは入力順を維持）", () => {
    const logs = [
      { id: "a", date: "2026-04-28T00:00:00.000Z" },
      { id: "b", date: "2026-04-28T00:00:00.000Z" },
      { id: "c", date: "2026-04-27T00:00:00.000Z" },
    ];
    const groups = groupBulletinLogsByDate(logs);
    expect(groups).toHaveLength(2);
    expect(groups[0].dateStr).toBe("2026-04-28");
    expect(groups[0].logs.map((l) => l.id)).toEqual(["a", "b"]);
    expect(groups[1].dateStr).toBe("2026-04-27");
    expect(groups[1].logs.map((l) => l.id)).toEqual(["c"]);
  });

  it("空配列は空配列を返す", () => {
    expect(groupBulletinLogsByDate([])).toEqual([]);
  });

  it("Date型を渡しても YYYY-MM-DD 文字列に正規化される", () => {
    const logs = [{ id: "x", date: new Date(Date.UTC(2026, 3, 28)) }];
    const groups = groupBulletinLogsByDate(logs);
    expect(groups[0].dateStr).toBe("2026-04-28");
  });
});

// ─── formatBulletinDateHeading ────────────────────────────────────────────────
describe("formatBulletinDateHeading", () => {
  it("M/D（曜）の掲示板 を返す（火曜）", () => {
    // 2026-04-28 は火曜日
    expect(formatBulletinDateHeading("2026-04-28")).toBe("4/28（火）の掲示板");
  });

  it("M/D（曜）の掲示板 を返す（月曜）", () => {
    // 2026-04-27 は月曜日
    expect(formatBulletinDateHeading("2026-04-27")).toBe("4/27（月）の掲示板");
  });

  it("M/D（曜）の掲示板 を返す（日曜）", () => {
    // 2026-04-26 は日曜日
    expect(formatBulletinDateHeading("2026-04-26")).toBe("4/26（日）の掲示板");
  });

  it("月初・月またぎを正しくフォーマットする", () => {
    // 2026-05-01 は金曜日
    expect(formatBulletinDateHeading("2026-05-01")).toBe("5/1（金）の掲示板");
  });
});
