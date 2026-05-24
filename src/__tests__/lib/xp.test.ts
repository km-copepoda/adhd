import { describe, it, expect } from "vitest";
import {
  calculateQuestXP,
  calcActualXP,
  xpRangeLabel,
  sumQuestXp,
  pendingXpByCategory,
} from "@/lib/xp";

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

  it("declared=true で宣言ボーナス +1（calcActualXP と同じ結果）", () => {
    expect(
      calculateQuestXP(
        {
          deadlineBonusEarned: true,
          photoUrl: null,
          template: { photoBonus: false },
        },
        true,
      ),
    ).toBe(3);
  });
});

describe("calcActualXP", () => {
  it("ボーナスなし → 1pt", () => {
    expect(calcActualXP(false, false, false)).toBe(1);
  });

  it("期限ボーナスあり → 2pt", () => {
    expect(calcActualXP(true, false, false)).toBe(2);
  });

  it("写真ボーナスあり・写真添付あり → 2pt", () => {
    expect(calcActualXP(false, true, true)).toBe(2);
  });

  it("写真ボーナスあり・写真添付なし → 1pt", () => {
    expect(calcActualXP(false, true, false)).toBe(1);
  });

  it("全ボーナスあり → 3pt", () => {
    expect(calcActualXP(true, true, true)).toBe(3);
  });

  it("期限ボーナスあり・写真ボーナスあり・写真なし → 2pt", () => {
    expect(calcActualXP(true, true, false)).toBe(2);
  });

  describe("「今日やる宣言」ボーナス", () => {
    it("declared=true のみ → 2pt（基本 1 + 宣言 1）", () => {
      expect(calcActualXP(false, false, false, true)).toBe(2);
    });

    it("declared=true + 期限ボーナス → 3pt", () => {
      expect(calcActualXP(true, false, false, true)).toBe(3);
    });

    it("全ボーナス + declared=true → 4pt", () => {
      expect(calcActualXP(true, true, true, true)).toBe(4);
    });

    it("declared 引数省略時は従来通り（=false 扱い）", () => {
      expect(calcActualXP(true, true, true)).toBe(3);
    });
  });
});

describe("xpRangeLabel", () => {
  it("deadline も photoBonus もない → +1pt", () => {
    expect(xpRangeLabel(false, false)).toBe("+1pt");
  });

  it("photoBonus のみ → +1〜2pt", () => {
    expect(xpRangeLabel(false, true)).toBe("+1〜2pt");
  });

  it("deadline のみ → +1〜2pt", () => {
    expect(xpRangeLabel(true, false)).toBe("+1〜2pt");
  });

  it("deadline も photoBonus もある → +1〜3pt", () => {
    expect(xpRangeLabel(true, true)).toBe("+1〜3pt");
  });

  describe("「今日やる宣言」ボーナスを含むレンジ", () => {
    it("declared=true のみ → +2pt（宣言ボーナス確定で範囲なし）", () => {
      expect(xpRangeLabel(false, false, true)).toBe("+2pt");
    });

    it("declared=true + deadline → +2〜3pt", () => {
      expect(xpRangeLabel(true, false, true)).toBe("+2〜3pt");
    });

    it("declared=true + photoBonus → +2〜3pt", () => {
      expect(xpRangeLabel(false, true, true)).toBe("+2〜3pt");
    });

    it("declared=true + deadline + photoBonus → +2〜4pt（全部入り）", () => {
      expect(xpRangeLabel(true, true, true)).toBe("+2〜4pt");
    });

    it("declared=false（デフォルト）は従来通り宣言ボーナスを含まない", () => {
      expect(xpRangeLabel(true, true, false)).toBe("+1〜3pt");
    });
  });
});

describe("sumQuestXp", () => {
  const makeQuest = (overrides: {
    status: "PENDING" | "REPORTED" | "APPROVED" | "REJECTED" | "SKIPPED" | "SKIP_REPORTED";
    deadlineBonusEarned?: boolean;
    photoUrl?: string | null;
    declaredToday?: boolean;
    photoBonus?: boolean;
  }) => ({
    status: overrides.status,
    deadlineBonusEarned: overrides.deadlineBonusEarned ?? false,
    photoUrl: overrides.photoUrl ?? null,
    declaredToday: overrides.declaredToday ?? false,
    template: { photoBonus: overrides.photoBonus ?? false },
  });

  it("空配列は 0", () => {
    expect(sumQuestXp([], "REPORTED")).toBe(0);
  });

  it("status が一致しないものは含めない", () => {
    expect(sumQuestXp([makeQuest({ status: "PENDING" })], "REPORTED")).toBe(0);
  });

  it("REPORTED の基本クエスト 1 件 → 1", () => {
    expect(sumQuestXp([makeQuest({ status: "REPORTED" })], "REPORTED")).toBe(1);
  });

  it("REPORTED で 期限+宣言 → 3（個別タイル表示と仮ゲージが一致するべき回帰ケース）", () => {
    expect(
      sumQuestXp(
        [makeQuest({ status: "REPORTED", deadlineBonusEarned: true, declaredToday: true })],
        "REPORTED",
      ),
    ).toBe(3);
  });

  it("REPORTED で 期限+宣言+写真 → 4 (全部入り)", () => {
    expect(
      sumQuestXp(
        [
          makeQuest({
            status: "REPORTED",
            deadlineBonusEarned: true,
            declaredToday: true,
            photoBonus: true,
            photoUrl: "https://x/y.jpg",
          }),
        ],
        "REPORTED",
      ),
    ).toBe(4);
  });

  it("APPROVED 用フィルタは REPORTED を含めない", () => {
    const quests = [
      makeQuest({ status: "REPORTED", deadlineBonusEarned: true }),
      makeQuest({ status: "APPROVED", deadlineBonusEarned: true, declaredToday: true }),
    ];
    expect(sumQuestXp(quests, "APPROVED")).toBe(3);
    expect(sumQuestXp(quests, "REPORTED")).toBe(2);
  });

  it("photoBonus=true でも photoUrl が無ければ写真加点しない", () => {
    expect(
      sumQuestXp(
        [makeQuest({ status: "REPORTED", photoBonus: true, photoUrl: null })],
        "REPORTED",
      ),
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
