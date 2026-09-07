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

  // --- carryOver 写像と #129 P1: 生成時 carryOver 値の非復元性 ---
  //
  // 生成時の carryOver 値は QuestInstance に保存されておらず、親が PUT /api/tasks/[id] で
  // 後から変更しうる。よって「報告日が quest.date より後の JST 暦日にずれている」
  // クエスト（carryOver の値で支配日が変わりうるもの）がその treasureDate に絡む場合は、
  // true/false どちらの仮定でも結論が同じにならない限り SKIP（CARRYOVER_AMBIGUOUS）する。

  it("同日報告の carryOver=true クエストは carryOver に非依存なので通常通り UNLOCK", () => {
    const sameDayCarry = quest({
      date: d(2026, 8, 20),
      carryOver: true,
      reportedAt: d(2026, 8, 20),
      status: "APPROVED",
    });
    const result = classifyOrphanTreasure({
      treasureDate: d(2026, 8, 20),
      treasureStatus: "LOCKED",
      today: TODAY,
      quests: [sameDayCarry],
    });
    expect(result.action).toBe("UNLOCK");
  });

  it("reportedAt=null のクエストは quest.date で写像され、carryOver 非依存として扱う（クラッシュしない）", () => {
    const q = quest({
      date: d(2026, 8, 19),
      carryOver: true,
      reportedAt: null,
      status: "APPROVED",
    });
    const result = classifyOrphanTreasure({
      treasureDate: d(2026, 8, 19),
      treasureStatus: "LOCKED",
      today: TODAY,
      quests: [q],
    });
    expect(result.action).toBe("UNLOCK");
  });

  it("#129 P1: 報告日が quest.date を跨ぐ APPROVED クエストは SKIP かつ reason に CARRYOVER_AMBIGUOUS", () => {
    const lateReport = quest({
      date: d(2026, 8, 19),
      carryOver: true,
      reportedAt: d(2026, 8, 20),
      status: "APPROVED",
    });
    const result = classifyOrphanTreasure({
      treasureDate: d(2026, 8, 20),
      treasureStatus: "LOCKED",
      today: TODAY,
      quests: [lateReport],
    });
    expect(result.action).toBe("SKIP");
    expect(result.reason).toContain("CARRYOVER_AMBIGUOUS");
  });

  it("#129 P1: carryOver=false でも報告日が跨いでいれば生成時の値が不明なため SKIP（CARRYOVER_AMBIGUOUS）", () => {
    const quest19 = quest({
      date: d(2026, 8, 19),
      carryOver: false,
      reportedAt: d(2026, 8, 25), // 差し戻し→再報告等で報告日が大きくずれた
      status: "APPROVED",
    });
    const result = classifyOrphanTreasure({
      treasureDate: d(2026, 8, 19),
      treasureStatus: "LOCKED",
      today: TODAY,
      quests: [quest19],
    });
    expect(result.action).toBe("SKIP");
    expect(result.reason).toContain("CARRYOVER_AMBIGUOUS");
  });

  it("#129 P1: JST境界 reportedAt=2026-08-20T14:59:59.999Z（quest.date=8/20 と同JST日）→ 非依存で UNLOCK", () => {
    const q = quest({
      date: d(2026, 8, 20),
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

  it("#129 P1: JST境界 reportedAt=2026-08-20T15:00:00.000Z（quest.date=8/20 の翌JST日）→ 跨ぎのため SKIP", () => {
    const q = quest({
      date: d(2026, 8, 20),
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
    expect(result.action).toBe("SKIP");
    expect(result.reason).toContain("CARRYOVER_AMBIGUOUS");
  });

  it("#129 P1: 跨ぎクエストでも当該 treasureDate に一致しなければ guard は発動しない", () => {
    const unrelatedLate = quest({
      date: d(2026, 8, 18),
      carryOver: true,
      reportedAt: d(2026, 8, 19), // 跨いでいるが asTrue=8/19 / asFalse=8/18 のどちらも D(8/20) ではない
      status: "APPROVED",
    });
    const dominatingD = quest({
      date: D,
      carryOver: false,
      reportedAt: D,
      status: "APPROVED",
    });
    const result = classifyOrphanTreasure({
      treasureDate: D,
      treasureStatus: "LOCKED",
      today: TODAY,
      quests: [unrelatedLate, dominatingD],
    });
    expect(result.action).toBe("UNLOCK");
  });
});
