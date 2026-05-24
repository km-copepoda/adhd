import { describe, it, expect } from "vitest";
import { calculateQuestXP, pendingXpByCategory } from "@/lib/xp";

describe("calculateQuestXP", () => {
  it("基本 1pt", () => {
    expect(
      calculateQuestXP({
        deadlineBonusEarned: false,
        photoUrl: null,
        template: { photoBonus: false },
      }),
    ).toBe(1);
  });

  it("期限ボーナスあり → 2pt", () => {
    expect(
      calculateQuestXP({
        deadlineBonusEarned: true,
        photoUrl: null,
        template: { photoBonus: false },
      }),
    ).toBe(2);
  });

  it("写真ボーナスは template.photoBonus と photoUrl の両方が真で +1", () => {
    expect(
      calculateQuestXP({
        deadlineBonusEarned: false,
        photoUrl: "x",
        template: { photoBonus: true },
      }),
    ).toBe(2);
    expect(
      calculateQuestXP({
        deadlineBonusEarned: false,
        photoUrl: null,
        template: { photoBonus: true },
      }),
    ).toBe(1);
  });
});

describe("pendingXpByCategory", () => {
  const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  it("空配列 → 全カテゴリ 0", () => {
    expect(pendingXpByCategory([], [])).toEqual({ STUDY: 0, STAMINA: 0, LIFE: 0 });
  });

  it("宣言なしの REPORTED クエストは calculateQuestXP と同じ値（カテゴリ別合算）", () => {
    const totals = pendingXpByCategory(
      [
        {
          templateId: "t1",
          reportedAt: new Date("2026-05-24T10:00:00+09:00"),
          deadlineBonusEarned: true,
          photoUrl: null,
          snapshotCategory: null,
          template: { category: "STUDY", photoBonus: false },
        },
        {
          templateId: "t2",
          reportedAt: new Date("2026-05-24T10:00:00+09:00"),
          deadlineBonusEarned: false,
          photoUrl: null,
          snapshotCategory: null,
          template: { category: "STAMINA", photoBonus: false },
        },
      ],
      [],
    );
    expect(totals).toEqual({ STUDY: 2, STAMINA: 1, LIFE: 0 });
  });

  it("regression: 宣言＋期限＋基本のクエストは +3 と集計される（タイル個別表示と一致）", () => {
    const quest = {
      templateId: "t1",
      reportedAt: new Date("2026-05-24T10:00:00+09:00"), // JST 2026-05-24
      deadlineBonusEarned: true,
      photoUrl: null,
      snapshotCategory: null,
      template: { category: "STUDY" as const, photoBonus: false },
    };
    const totals = pendingXpByCategory(
      [quest],
      [{ templateId: "t1", date: D("2026-05-24") }],
    );
    expect(totals.STUDY).toBe(3);
  });

  it("宣言の date が reportedAt の JST 日付と一致しなければ宣言ボーナス非加算", () => {
    const quest = {
      templateId: "t1",
      reportedAt: new Date("2026-05-24T10:00:00+09:00"),
      deadlineBonusEarned: false,
      photoUrl: null,
      snapshotCategory: null,
      template: { category: "STUDY" as const, photoBonus: false },
    };
    const totals = pendingXpByCategory(
      [quest],
      [{ templateId: "t1", date: D("2026-05-23") }],
    );
    expect(totals.STUDY).toBe(1);
  });

  it("templateId が一致しない宣言は無視", () => {
    const totals = pendingXpByCategory(
      [
        {
          templateId: "t1",
          reportedAt: new Date("2026-05-24T10:00:00+09:00"),
          deadlineBonusEarned: false,
          photoUrl: null,
          snapshotCategory: null,
          template: { category: "LIFE", photoBonus: false },
        },
      ],
      [{ templateId: "OTHER", date: D("2026-05-24") }],
    );
    expect(totals.LIFE).toBe(1);
  });

  it("snapshotCategory が優先される", () => {
    const totals = pendingXpByCategory(
      [
        {
          templateId: "t1",
          reportedAt: new Date("2026-05-24T10:00:00+09:00"),
          deadlineBonusEarned: false,
          photoUrl: null,
          snapshotCategory: "LIFE",
          template: { category: "STUDY", photoBonus: false },
        },
      ],
      [],
    );
    expect(totals).toEqual({ STUDY: 0, STAMINA: 0, LIFE: 1 });
  });

  it("reportedAt が null のクエスト（保険）は宣言ボーナス非加算で基本のみ", () => {
    const totals = pendingXpByCategory(
      [
        {
          templateId: "t1",
          reportedAt: null,
          deadlineBonusEarned: true,
          photoUrl: null,
          snapshotCategory: null,
          template: { category: "STUDY", photoBonus: false },
        },
      ],
      [{ templateId: "t1", date: D("2026-05-24") }],
    );
    expect(totals.STUDY).toBe(2);
  });

  it("JST 深夜（UTC 前日）の reportedAt も JST 日付として宣言照合する", () => {
    // JST 2026-05-25 00:30 = UTC 2026-05-24 15:30
    const quest = {
      templateId: "t1",
      reportedAt: new Date("2026-05-24T15:30:00Z"),
      deadlineBonusEarned: false,
      photoUrl: null,
      snapshotCategory: null,
      template: { category: "STUDY" as const, photoBonus: false },
    };
    const totals = pendingXpByCategory(
      [quest],
      [{ templateId: "t1", date: D("2026-05-25") }],
    );
    expect(totals.STUDY).toBe(2); // 1 + 1(declared)
  });
});
