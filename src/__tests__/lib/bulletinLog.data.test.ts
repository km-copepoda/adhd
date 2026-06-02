import { describe, it, expect } from "vitest";
import {
  buildBulletinMessage,
  getProgressMilestones,
  getBulletinLogEmoji,
  groupBulletinLogsByDate,
  formatBulletinDateHeading,
  coalesceTaskProgress,
  coalesceBurst,
} from "@/lib/bulletinLog.data";

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

  it("STAMP_SENT: みんなにエールを送ったメッセージ", () => {
    const msg = buildBulletinMessage("STAMP_SENT", "ドラゴン");
    expect(msg).toContain("ドラゴン");
    expect(msg).toContain("みんな");
    expect(msg).toContain("エール");
  });

  it("COLLECTION_ITEM_OBTAINED: 子供名・アイテム名・季節・レア度(★)を含む", () => {
    const msg = buildBulletinMessage("COLLECTION_ITEM_OBTAINED", "たろう", "summer-01");
    expect(msg).toContain("たろう");
    expect(msg).toContain("カブトムシ");
    expect(msg).toContain("夏");
    expect(msg).toContain("★");
  });

  it("COLLECTION_ITEM_OBTAINED: RARE (★★★) のとき星 3 つを含む", () => {
    const msg = buildBulletinMessage("COLLECTION_ITEM_OBTAINED", "たろう", "summer-04");
    expect(msg).toContain("リュウグウノツカイ");
    expect(msg).toContain("★★★");
  });

  it("COLLECTION_ITEM_OBTAINED: 未知の id は空文字列を返す (書き込みされない)", () => {
    expect(buildBulletinMessage("COLLECTION_ITEM_OBTAINED", "たろう", "bogus-99")).toBe("");
  });

  it("COLLECTION_ITEM_OBTAINED: extra 未指定でも空文字列", () => {
    expect(buildBulletinMessage("COLLECTION_ITEM_OBTAINED", "たろう")).toBe("");
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

  it("STAMP_SENT → 📣（メガホン: みんなへの呼びかけ）", () => {
    expect(getBulletinLogEmoji("STAMP_SENT")).toBe("📣");
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

// ─── coalesceTaskProgress ─────────────────────────────────────────────────────
describe("coalesceTaskProgress", () => {
  it("空配列はそのまま空配列を返す", () => {
    expect(coalesceTaskProgress([])).toEqual([]);
  });

  it("非TASKログ（バッジ等）は素通しする", () => {
    const logs = [
      { id: "b1", childId: "c1", type: "BADGE_UNLOCKED", date: "2026-05-04T00:00:00.000Z", createdAt: "2026-05-04T08:20:00.000Z" },
      { id: "e1", childId: "c1", type: "MONSTER_EVOLVED", date: "2026-05-04T00:00:00.000Z", createdAt: "2026-05-04T08:20:00.000Z" },
    ];
    expect(coalesceTaskProgress(logs).map((l) => l.id)).toEqual(["b1", "e1"]);
  });

  it("同じ子供・同じ日のTASK_*は最新1件のみ残す（先頭優先）", () => {
    const logs = [
      { id: "t-latest", childId: "c1", type: "TASK_PROGRESS_75", date: "2026-05-04T00:00:00.000Z", createdAt: "2026-05-04T22:38:00.000Z" },
      { id: "t-mid",    childId: "c1", type: "TASK_PROGRESS_50", date: "2026-05-04T00:00:00.000Z", createdAt: "2026-05-04T18:10:00.000Z" },
      { id: "t-old",    childId: "c1", type: "TASK_STARTED",     date: "2026-05-04T00:00:00.000Z", createdAt: "2026-05-04T09:00:00.000Z" },
    ];
    const out = coalesceTaskProgress(logs);
    expect(out.map((l) => l.id)).toEqual(["t-latest"]);
  });

  it("子供が異なれば別個に残す", () => {
    const logs = [
      { id: "t-c1", childId: "c1", type: "TASK_PROGRESS_50", date: "2026-05-04T00:00:00.000Z", createdAt: "2026-05-04T20:00:00.000Z" },
      { id: "t-c2", childId: "c2", type: "TASK_PROGRESS_25", date: "2026-05-04T00:00:00.000Z", createdAt: "2026-05-04T18:00:00.000Z" },
    ];
    const out = coalesceTaskProgress(logs);
    expect(out.map((l) => l.id).sort()).toEqual(["t-c1", "t-c2"]);
  });

  it("日付が異なれば別個に残す", () => {
    const logs = [
      { id: "t-may4", childId: "c1", type: "TASK_PROGRESS_50", date: "2026-05-04T00:00:00.000Z", createdAt: "2026-05-04T20:00:00.000Z" },
      { id: "t-may3", childId: "c1", type: "TASK_COMPLETE",    date: "2026-05-03T00:00:00.000Z", createdAt: "2026-05-03T22:00:00.000Z" },
    ];
    const out = coalesceTaskProgress(logs);
    expect(out.map((l) => l.id).sort()).toEqual(["t-may3", "t-may4"]);
  });

  it("TASK_*とバッジが混在しても、TASK_*の重複だけ間引かれる", () => {
    const logs = [
      { id: "b1",       childId: "c1", type: "BADGE_UNLOCKED",   date: "2026-05-04T00:00:00.000Z", createdAt: "2026-05-04T08:20:01.000Z" },
      { id: "t-latest", childId: "c1", type: "TASK_PROGRESS_75", date: "2026-05-04T00:00:00.000Z", createdAt: "2026-05-04T22:38:00.000Z" },
      { id: "t-old",    childId: "c1", type: "TASK_STARTED",     date: "2026-05-04T00:00:00.000Z", createdAt: "2026-05-04T09:00:00.000Z" },
    ];
    const out = coalesceTaskProgress(logs);
    expect(out.map((l) => l.id)).toEqual(["b1", "t-latest"]);
  });

  it("入力順（date desc, createdAt desc）を維持する", () => {
    const logs = [
      { id: "t-may4", childId: "c1", type: "TASK_PROGRESS_75", date: "2026-05-04T00:00:00.000Z", createdAt: "2026-05-04T22:00:00.000Z" },
      { id: "b-may4", childId: "c1", type: "BADGE_UNLOCKED",   date: "2026-05-04T00:00:00.000Z", createdAt: "2026-05-04T18:00:00.000Z" },
      { id: "t-may3", childId: "c1", type: "TASK_COMPLETE",    date: "2026-05-03T00:00:00.000Z", createdAt: "2026-05-03T22:00:00.000Z" },
    ];
    const out = coalesceTaskProgress(logs);
    expect(out.map((l) => l.id)).toEqual(["t-may4", "b-may4", "t-may3"]);
  });
});

// ─── coalesceBurst ────────────────────────────────────────────────────────────
describe("coalesceBurst", () => {
  const base = (over: Partial<{ id: string; childId: string; type: string; createdAt: string; date: string }>) => ({
    id: "x",
    childId: "c1",
    type: "BADGE_UNLOCKED",
    date: "2026-05-04T00:00:00.000Z",
    createdAt: "2026-05-04T08:20:00.000Z",
    ...over,
  });

  it("空配列は空配列を返す", () => {
    expect(coalesceBurst([])).toEqual([]);
  });

  it("単発ログは items.length===1 の CondensedLogEntry にラップする", () => {
    const out = coalesceBurst([base({ id: "a" })]);
    expect(out).toHaveLength(1);
    expect(out[0].primary.id).toBe("a");
    expect(out[0].items).toHaveLength(1);
    expect(out[0].items[0].id).toBe("a");
  });

  it("同 childId+type が時間窓内に並んだら1件に束ねる（primary は最新=先頭）", () => {
    const logs = [
      base({ id: "b3", createdAt: "2026-05-04T08:20:30.000Z" }),
      base({ id: "b2", createdAt: "2026-05-04T08:20:15.000Z" }),
      base({ id: "b1", createdAt: "2026-05-04T08:20:00.000Z" }),
    ];
    const out = coalesceBurst(logs);
    expect(out).toHaveLength(1);
    expect(out[0].primary.id).toBe("b3");
    expect(out[0].items.map((i) => i.id)).toEqual(["b3", "b2", "b1"]);
  });

  it("同 childId+type でも時間窓を超えたら別エントリ", () => {
    const logs = [
      base({ id: "b2", createdAt: "2026-05-04T08:30:00.000Z" }),
      base({ id: "b1", createdAt: "2026-05-04T08:20:00.000Z" }),
    ];
    const out = coalesceBurst(logs);
    expect(out).toHaveLength(2);
    expect(out[0].primary.id).toBe("b2");
    expect(out[1].primary.id).toBe("b1");
  });

  it("type が異なれば束ねない", () => {
    const logs = [
      base({ id: "e1", type: "MONSTER_EVOLVED", createdAt: "2026-05-04T08:20:30.000Z" }),
      base({ id: "b1", type: "BADGE_UNLOCKED",  createdAt: "2026-05-04T08:20:00.000Z" }),
    ];
    const out = coalesceBurst(logs);
    expect(out).toHaveLength(2);
    expect(out.map((g) => g.primary.id)).toEqual(["e1", "b1"]);
  });

  it("childId が異なれば束ねない（同 type・同時刻でも）", () => {
    const logs = [
      base({ id: "b-c2", childId: "c2", createdAt: "2026-05-04T08:20:30.000Z" }),
      base({ id: "b-c1", childId: "c1", createdAt: "2026-05-04T08:20:00.000Z" }),
    ];
    const out = coalesceBurst(logs);
    expect(out).toHaveLength(2);
  });

  it("入力の時系列降順を出力でも維持する（束ね後のエントリも降順）", () => {
    const logs = [
      base({ id: "later",  createdAt: "2026-05-04T16:00:00.000Z", type: "MONSTER_EVOLVED" }),
      base({ id: "burst3", createdAt: "2026-05-04T08:20:30.000Z" }),
      base({ id: "burst2", createdAt: "2026-05-04T08:20:15.000Z" }),
      base({ id: "burst1", createdAt: "2026-05-04T08:20:00.000Z" }),
    ];
    const out = coalesceBurst(logs);
    expect(out).toHaveLength(2);
    expect(out[0].primary.id).toBe("later");
    expect(out[1].primary.id).toBe("burst3");
    expect(out[1].items).toHaveLength(3);
  });

  it("境界値: 時間窓ちょうど5分は同一バーストに含める", () => {
    const logs = [
      base({ id: "b2", createdAt: "2026-05-04T08:25:00.000Z" }),
      base({ id: "b1", createdAt: "2026-05-04T08:20:00.000Z" }),
    ];
    const out = coalesceBurst(logs);
    expect(out).toHaveLength(1);
    expect(out[0].items).toHaveLength(2);
  });

  it("windowMs を渡して時間窓を上書きできる", () => {
    const logs = [
      base({ id: "b2", createdAt: "2026-05-04T08:21:00.000Z" }),
      base({ id: "b1", createdAt: "2026-05-04T08:20:00.000Z" }),
    ];
    const out = coalesceBurst(logs, 30_000);
    expect(out).toHaveLength(2);
  });

  it("バースト判定は連続要素間の差分で行う（最初と最後の差ではない）", () => {
    const logs = [
      base({ id: "b3", createdAt: "2026-05-04T08:28:00.000Z" }),
      base({ id: "b2", createdAt: "2026-05-04T08:24:00.000Z" }),
      base({ id: "b1", createdAt: "2026-05-04T08:20:00.000Z" }),
    ];
    const out = coalesceBurst(logs);
    expect(out).toHaveLength(1);
    expect(out[0].items.map((i) => i.id)).toEqual(["b3", "b2", "b1"]);
  });
});

// ─── formatBulletinDateHeading ────────────────────────────────────────────────
describe("formatBulletinDateHeading", () => {
  it("M/D（曜）の掲示板 を返す（火曜）", () => {
    expect(formatBulletinDateHeading("2026-04-28")).toBe("4/28（火）の掲示板");
  });

  it("M/D（曜）の掲示板 を返す（月曜）", () => {
    expect(formatBulletinDateHeading("2026-04-27")).toBe("4/27（月）の掲示板");
  });

  it("M/D（曜）の掲示板 を返す（日曜）", () => {
    expect(formatBulletinDateHeading("2026-04-26")).toBe("4/26（日）の掲示板");
  });

  it("月初・月またぎを正しくフォーマットする", () => {
    expect(formatBulletinDateHeading("2026-05-01")).toBe("5/1（金）の掲示板");
  });
});
