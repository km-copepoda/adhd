import { describe, it, expect } from "vitest";
import {
  getQuestTimeProgressBucket,
  buildQuestTimeNotification,
  QUEST_TIME_MESSAGES,
} from "@/lib/notifyMessages";

describe("getQuestTimeProgressBucket", () => {
  it("クエストが0件の場合は DONE を返す（通知不要扱い）", () => {
    expect(getQuestTimeProgressBucket(0, 0)).toBe("DONE");
  });

  it("done=0 / total>0 の場合は NOT_STARTED", () => {
    expect(getQuestTimeProgressBucket(0, 3)).toBe("NOT_STARTED");
  });

  it("進捗1%（小さな1件達成）は EARLY", () => {
    expect(getQuestTimeProgressBucket(1, 100)).toBe("EARLY");
  });

  it("進捗33%は EARLY", () => {
    expect(getQuestTimeProgressBucket(1, 3)).toBe("EARLY");
  });

  it("進捗79%（境界手前）は EARLY", () => {
    expect(getQuestTimeProgressBucket(79, 100)).toBe("EARLY");
  });

  it("進捗ちょうど80%（境界）は ALMOST", () => {
    expect(getQuestTimeProgressBucket(80, 100)).toBe("ALMOST");
  });

  it("進捗99%は ALMOST", () => {
    expect(getQuestTimeProgressBucket(99, 100)).toBe("ALMOST");
  });

  it("done===total（100%完了）は DONE", () => {
    expect(getQuestTimeProgressBucket(3, 3)).toBe("DONE");
  });

  it("done > total（カウント超過、通常起き得ないが安全側で）は DONE", () => {
    expect(getQuestTimeProgressBucket(5, 3)).toBe("DONE");
  });

  it("少数クエスト（total=1, done=0）は NOT_STARTED", () => {
    expect(getQuestTimeProgressBucket(0, 1)).toBe("NOT_STARTED");
  });

  it("少数クエスト（total=1, done=1）は DONE", () => {
    expect(getQuestTimeProgressBucket(1, 1)).toBe("DONE");
  });
});

describe("QUEST_TIME_MESSAGES プール", () => {
  it("NOT_STARTED / EARLY / ALMOST 各バケットに3件以上のメッセージがある", () => {
    expect(QUEST_TIME_MESSAGES.NOT_STARTED.length).toBeGreaterThanOrEqual(3);
    expect(QUEST_TIME_MESSAGES.EARLY.length).toBeGreaterThanOrEqual(3);
    expect(QUEST_TIME_MESSAGES.ALMOST.length).toBeGreaterThanOrEqual(3);
  });

  it("子供にとって冷たい印象の定型文を含まない（やってはいけない文言の検査）", () => {
    const all = [
      ...QUEST_TIME_MESSAGES.NOT_STARTED,
      ...QUEST_TIME_MESSAGES.EARLY,
      ...QUEST_TIME_MESSAGES.ALMOST,
    ];
    const forbidden = ["わかりました。", "あと少しですね"];
    for (const msg of all) {
      for (const word of forbidden) {
        expect(msg).not.toContain(word);
      }
    }
  });
});

describe("buildQuestTimeNotification", () => {
  it("DONE（全完了済み）の場合は null を返す（Push スキップ）", () => {
    expect(buildQuestTimeNotification({ done: 3, total: 3 })).toBeNull();
  });

  it("total=0（タスク無し）の場合も null を返す", () => {
    expect(buildQuestTimeNotification({ done: 0, total: 0 })).toBeNull();
  });

  it("NOT_STARTED 時は NOT_STARTED プールからメッセージを返す", () => {
    // random=0 で必ず先頭要素を選ぶ
    const result = buildQuestTimeNotification({ done: 0, total: 3, random: () => 0 });
    expect(result).not.toBeNull();
    expect(result!.body).toBe(QUEST_TIME_MESSAGES.NOT_STARTED[0]);
    expect(result!.title).toBe("⏰ クエストタイム");
  });

  it("EARLY 時は EARLY プールからメッセージを返す", () => {
    const result = buildQuestTimeNotification({ done: 1, total: 3, random: () => 0 });
    expect(result).not.toBeNull();
    expect(result!.body).toBe(QUEST_TIME_MESSAGES.EARLY[0]);
  });

  it("ALMOST 時は ALMOST プールからメッセージを返す", () => {
    const result = buildQuestTimeNotification({ done: 4, total: 5, random: () => 0 });
    expect(result).not.toBeNull();
    expect(result!.body).toBe(QUEST_TIME_MESSAGES.ALMOST[0]);
  });

  it("random=0.999 の場合は各プールの最終要素を選ぶ", () => {
    const result = buildQuestTimeNotification({ done: 0, total: 3, random: () => 0.999 });
    expect(result).not.toBeNull();
    const pool = QUEST_TIME_MESSAGES.NOT_STARTED;
    expect(result!.body).toBe(pool[pool.length - 1]);
  });

  it("デフォルト random（未指定）でも null 以外を返す（実行時の煙テスト）", () => {
    const result = buildQuestTimeNotification({ done: 0, total: 1 });
    expect(result).not.toBeNull();
    expect(typeof result!.body).toBe("string");
    expect(result!.body.length).toBeGreaterThan(0);
  });
});
