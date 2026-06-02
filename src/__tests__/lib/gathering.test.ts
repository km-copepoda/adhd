import { describe, it, expect } from "vitest";
import {
  normalizeSecretWord,
  LOCATION_CAPACITY,
  getStampProgressStatus,
  buildStampMessage,
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

// ─── getStampProgressStatus ──────────────────────────────────────────────────
describe("getStampProgressStatus", () => {
  it("total=0 は NOT_STARTED（タスクが無い日も未着手扱い）", () => {
    expect(getStampProgressStatus(0, 0)).toBe("NOT_STARTED");
  });

  it("done=0 は NOT_STARTED", () => {
    expect(getStampProgressStatus(0, 3)).toBe("NOT_STARTED");
  });

  it("0 < done < total は IN_PROGRESS", () => {
    expect(getStampProgressStatus(1, 3)).toBe("IN_PROGRESS");
    expect(getStampProgressStatus(2, 3)).toBe("IN_PROGRESS");
  });

  it("done === total は DONE（境界値）", () => {
    expect(getStampProgressStatus(3, 3)).toBe("DONE");
    expect(getStampProgressStatus(1, 1)).toBe("DONE");
  });

  it("done > total はあり得ない想定だが DONE として扱う（防御的）", () => {
    expect(getStampProgressStatus(5, 3)).toBe("DONE");
  });
});

// ─── buildStampMessage ────────────────────────────────────────────────────────
describe("buildStampMessage", () => {
  it("NOT_STARTED: 送信者名 + スタートを促すメッセージ", () => {
    const msg = buildStampMessage("たろう", "NOT_STARTED");
    expect(msg).toContain("たろう");
    expect(msg).toContain("エール");
  });

  it("IN_PROGRESS: 送信者名 + 継続を励ますメッセージ", () => {
    const msg = buildStampMessage("はなこ", "IN_PROGRESS");
    expect(msg).toContain("はなこ");
    expect(msg).toContain("エール");
  });

  it("DONE: 送信者名 + 達成を称えるメッセージ", () => {
    const msg = buildStampMessage("けんた", "DONE");
    expect(msg).toContain("けんた");
    expect(msg).toContain("エール");
  });

  it("3つの状態でメッセージが全て異なる", () => {
    const a = buildStampMessage("X", "NOT_STARTED");
    const b = buildStampMessage("X", "IN_PROGRESS");
    const c = buildStampMessage("X", "DONE");
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("メッセージにタスク名や数値などの具体情報を含めない（プライバシー方針）", () => {
    const msg = buildStampMessage("たろう", "IN_PROGRESS");
    expect(msg).not.toMatch(/[0-9０-９]/);
  });
});
