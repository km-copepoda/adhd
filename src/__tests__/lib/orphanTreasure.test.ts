import { describe, it, expect } from "vitest";
import { classifyOrphanTreasure } from "@/lib/orphanTreasure";

/**
 * classifyOrphanTreasure の単体テスト（Issue #109）。
 *
 * 「開かずの宝箱」= status:"LOCKED" かつ date < todayJST() のまま放置された TreasureLog。
 * 同一 childId の QuestInstance 群のうち、resolveTreasureDate(quest.date, carryOver, reportedAt ?? quest.date)
 * が対象日 D に一致するものを「D を支配するクエスト」として分類する。
 *
 * 分類ルールの優先順位:
 *   1. REPORTED / SKIP_REPORTED が支配クエストに1件でも残る → SKIP
 *   2. quest.date === D の PENDING が支配クエストに1件でも残る → SKIP（APPROVED併存でもSKIP優先）
 *   3. APPROVED または SKIPPED が1件以上 → UNLOCK（APPROVED/REJECTED混在時はreasonに明記）
 *   4. 支配クエストが1件以上あり全て REJECTED → CANCEL
 *   5. 支配クエストが0件 → SKIP（reasonにUNRESOLVEDを含む）
 */

/** JST日付のUTC 0時表現（@db.Date と同じ形）を作るヘルパー。month は 1-12 で指定。 */
function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

// 「今日」= 2026-08-22 JST。対象宝箱の date は基本的にこれより過去（8/19〜8/21）とする。
const TODAY = d(2026, 8, 22);
// 分類対象 TreasureLog の date (D) の既定値。
const D = d(2026, 8, 20);

interface QuestCandidateInput {
  date?: Date;
  status?: "PENDING" | "REPORTED" | "APPROVED" | "REJECTED" | "SKIPPED" | "SKIP_REPORTED";
  reportedAt?: Date | null;
  carryOver?: boolean;
}

/** D (2026-08-20) を支配する QuestInstance 候補の既定値（carryOverなし、当日中に承認）。 */
function quest(overrides?: QuestCandidateInput) {
  return {
    date: D,
    status: "APPROVED" as const,
    reportedAt: D,
    carryOver: false,
    ...overrides,
  };
}

interface ClassifyInput {
  treasureDate: Date;
  treasureStatus: "LOCKED" | "UNLOCKED" | "OPENED" | "CANCELLED";
  today: Date;
  quests: ReturnType<typeof quest>[];
}

function classify(overrides: Partial<ClassifyInput> & { quests: ReturnType<typeof quest>[] }) {
  return classifyOrphanTreasure({
    treasureDate: D,
    treasureStatus: "LOCKED",
    today: TODAY,
    ...overrides,
  });
}

describe("classifyOrphanTreasure", () => {
  it("LOCKED / date < today / 支配クエストにAPPROVEDが1件 → UNLOCK", () => {
    const result = classify({ quests: [quest({ status: "APPROVED" })] });
    expect(result.action).toBe("UNLOCK");
  });

  it("LOCKED / 支配クエストにSKIPPEDが1件 → UNLOCK", () => {
    const result = classify({ quests: [quest({ status: "SKIPPED" })] });
    expect(result.action).toBe("UNLOCK");
  });

  it("LOCKED / 支配クエストがAPPROVED+REJECTEDの混在 → UNLOCK（reasonに混在である旨を含む）", () => {
    const result = classify({
      quests: [quest({ status: "APPROVED" }), quest({ status: "REJECTED" })],
    });
    expect(result.action).toBe("UNLOCK");
    expect(result.reason).toContain("混在");
  });

  it("LOCKED / 支配クエストが全てREJECTED → CANCEL", () => {
    const result = classify({
      quests: [quest({ status: "REJECTED" }), quest({ status: "REJECTED" })],
    });
    expect(result.action).toBe("CANCEL");
  });

  it("LOCKED / 支配クエストにREPORTEDが1件でも残る → SKIP", () => {
    const result = classify({
      quests: [quest({ status: "APPROVED" }), quest({ status: "REPORTED" })],
    });
    expect(result.action).toBe("SKIP");
  });

  it("LOCKED / 支配クエストにSKIP_REPORTEDが1件でも残る → SKIP", () => {
    const result = classify({
      quests: [quest({ status: "APPROVED" }), quest({ status: "SKIP_REPORTED" })],
    });
    expect(result.action).toBe("SKIP");
  });

  it("LOCKED / quest.date===DのPENDINGが1件でも残る → SKIP（APPROVEDが併存していてもSKIP優先）", () => {
    const result = classify({
      quests: [quest({ status: "APPROVED" }), quest({ status: "PENDING", reportedAt: null })],
    });
    expect(result.action).toBe("SKIP");
  });

  it("LOCKED / 支配クエストが0件 → SKIPかつreasonがUNRESOLVED", () => {
    const result = classify({ quests: [] });
    expect(result.action).toBe("SKIP");
    expect(result.reason).toContain("UNRESOLVED");
  });

  it("境界値: date===todayJST() → SKIP（当日は正常な承認待ち、救済対象外）", () => {
    const result = classifyOrphanTreasure({
      treasureDate: TODAY,
      treasureStatus: "LOCKED",
      today: TODAY,
      quests: [quest({ date: TODAY, status: "APPROVED", reportedAt: TODAY })],
    });
    expect(result.action).toBe("SKIP");
  });

  it("境界値: date>todayJST()（未来日）→ SKIP", () => {
    const future = d(2026, 8, 23);
    const result = classifyOrphanTreasure({
      treasureDate: future,
      treasureStatus: "LOCKED",
      today: TODAY,
      quests: [quest({ date: future, status: "APPROVED", reportedAt: future })],
    });
    expect(result.action).toBe("SKIP");
  });

  it.each(["UNLOCKED", "OPENED", "CANCELLED"] as const)(
    "冪等性: statusが%sならSKIP（actionがUNLOCK/CANCELにならない）",
    (status) => {
      const result = classify({
        treasureStatus: status,
        quests: [quest({ status: "APPROVED" })],
      });
      expect(result.action).toBe("SKIP");
    },
  );

  it("carryOver写像: quest.date=8/19 / carryOver=true / reportedAt=8/20 は8/20の宝箱を支配し、8/19の宝箱は支配しない", () => {
    const carryQuest = quest({
      date: d(2026, 8, 19),
      carryOver: true,
      reportedAt: d(2026, 8, 20),
      status: "APPROVED",
    });

    const dominates20 = classifyOrphanTreasure({
      treasureDate: d(2026, 8, 20),
      treasureStatus: "LOCKED",
      today: TODAY,
      quests: [carryQuest],
    });
    expect(dominates20.action).toBe("UNLOCK");

    const notDominates19 = classifyOrphanTreasure({
      treasureDate: d(2026, 8, 19),
      treasureStatus: "LOCKED",
      today: TODAY,
      quests: [carryQuest],
    });
    expect(notDominates19.action).toBe("SKIP");
    expect(notDominates19.reason).toContain("UNRESOLVED");
  });

  it("carryOver=falseのquest.date=8/19は常に8/19の宝箱を支配する（reportedAtが何日でも）", () => {
    const quest19 = quest({
      date: d(2026, 8, 19),
      carryOver: false,
      reportedAt: d(2026, 8, 25), // 差し戻し→再報告等で承認日が大きくずれても写像は変わらない
      status: "APPROVED",
    });
    const result = classifyOrphanTreasure({
      treasureDate: d(2026, 8, 19),
      treasureStatus: "LOCKED",
      today: TODAY,
      quests: [quest19],
    });
    expect(result.action).toBe("UNLOCK");
  });

  it("JST境界値: reportedAt=2026-08-20T14:59:59.999Z（JST 8/20 23:59）→ 支配日は8/20", () => {
    const q = quest({
      date: d(2026, 8, 19),
      carryOver: true,
      reportedAt: new Date("2026-08-20T14:59:59.999Z"),
      status: "APPROVED",
    });
    const result = classifyOrphanTreasure({
      treasureDate: d(2026, 8, 20),
      treasureStatus: "LOCKED",
      today: TODAY,
      quests: [q],
    });
    expect(result.action).toBe("UNLOCK");
  });

  it("JST境界値: reportedAt=2026-08-20T15:00:00.000Z（JST 8/21 00:00）→ 支配日は8/21", () => {
    const q = quest({
      date: d(2026, 8, 19),
      carryOver: true,
      reportedAt: new Date("2026-08-20T15:00:00.000Z"),
      status: "APPROVED",
    });
    const result = classifyOrphanTreasure({
      treasureDate: d(2026, 8, 21),
      treasureStatus: "LOCKED",
      today: TODAY,
      quests: [q],
    });
    expect(result.action).toBe("UNLOCK");
  });

  it("reportedAt=nullのクエストはquest.dateで写像される（クラッシュしない）", () => {
    const q = quest({
      date: d(2026, 8, 19),
      carryOver: true,
      reportedAt: null,
      status: "APPROVED",
    });
    expect(() =>
      classifyOrphanTreasure({
        treasureDate: d(2026, 8, 19),
        treasureStatus: "LOCKED",
        today: TODAY,
        quests: [q],
      }),
    ).not.toThrow();

    const result = classifyOrphanTreasure({
      treasureDate: d(2026, 8, 19),
      treasureStatus: "LOCKED",
      today: TODAY,
      quests: [q],
    });
    expect(result.action).toBe("UNLOCK");
  });
});
