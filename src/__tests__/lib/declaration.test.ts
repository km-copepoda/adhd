import { describe, it, expect } from "vitest";
import {
  IDLE_EXPOSURE_THRESHOLD,
  DECLARATION_BONUS_XP,
  getMissedExposureCount,
  getIdleCalendarDays,
  isEligibleForDeclaration,
  groupRecentInstancesByTemplate,
} from "@/lib/declaration";

const day = (s: string) => new Date(s + "T00:00:00.000Z");

describe("groupRecentInstancesByTemplate", () => {
  type Row = { templateId: string; date: Date; id?: number };
  const DAY_MS = 24 * 60 * 60 * 1000;
  const BASE = Date.UTC(2026, 0, 1);
  const rowAt = (templateId: string, offset: number, id?: number): Row => ({
    templateId,
    date: new Date(BASE + offset * DAY_MS),
    id,
  });
  const makeRows = (templateId: string, n: number): Row[] =>
    Array.from({ length: n }, (_, i) => rowAt(templateId, i));

  it("rows が空でも templateIds 全要素がキーとして存在し空配列になる", () => {
    const m = groupRecentInstancesByTemplate<Row>([], ["a", "b"], 30);
    expect([...m.keys()].sort()).toEqual(["a", "b"]);
    expect(m.get("a")).toEqual([]);
    expect(m.get("b")).toEqual([]);
  });

  it("templateIds も空なら空 Map", () => {
    const m = groupRecentInstancesByTemplate<Row>(makeRows("a", 3), [], 30);
    expect(m.size).toBe(0);
  });

  it("templateIds に含まれない templateId の行は結果に含まれない", () => {
    const m = groupRecentInstancesByTemplate<Row>(
      [rowAt("a", 1), rowAt("x", 2)],
      ["a"],
      30,
    );
    expect(m.has("x")).toBe(false);
    expect(m.get("a")).toHaveLength(1);
  });

  it("templateIds に重複があってもキーは1つで行も重複しない", () => {
    const m = groupRecentInstancesByTemplate<Row>(makeRows("a", 3), ["a", "a"], 30);
    expect(m.size).toBe(1);
    expect(m.get("a")).toHaveLength(3);
  });

  it.each([1, 29, 30])("%i 件はそのまま全件返す（limit=30）", (n) => {
    const m = groupRecentInstancesByTemplate<Row>(makeRows("a", n), ["a"], 30);
    expect(m.get("a")).toHaveLength(n);
  });

  it("31 件のとき date 降順で新しい 30 件のみ（最古の1件が落ちる）", () => {
    const m = groupRecentInstancesByTemplate<Row>(makeRows("a", 31), ["a"], 30);
    const got = m.get("a")!;
    expect(got).toHaveLength(30);
    expect(got[0].date.getTime()).toBe(BASE + 30 * DAY_MS);
    expect(got[29].date.getTime()).toBe(BASE + 1 * DAY_MS);
  });

  it("date 降順で返る（入力が昇順でも）", () => {
    const m = groupRecentInstancesByTemplate<Row>(makeRows("a", 5), ["a"], 30);
    const times = m.get("a")!.map((r) => r.date.getTime());
    expect(times).toEqual([...times].sort((x, y) => y - x));
  });

  it("入力がバラバラ順でも降順になる", () => {
    const rows = [rowAt("a", 3), rowAt("a", 10), rowAt("a", 1), rowAt("a", 7)];
    const m = groupRecentInstancesByTemplate<Row>(rows, ["a"], 30);
    expect(m.get("a")!.map((r) => (r.date.getTime() - BASE) / DAY_MS)).toEqual([10, 7, 3, 1]);
  });

  it("テンプレート複数で片方だけ 30 件超でも各々独立に絞る", () => {
    const rows = [...makeRows("a", 45), ...makeRows("b", 5)];
    const m = groupRecentInstancesByTemplate<Row>(rows, ["a", "b"], 30);
    expect(m.get("a")).toHaveLength(30);
    expect(m.get("b")).toHaveLength(5);
  });

  it("全体で先に切ってからグループ化しない（古い側のテンプレートも自分の30件を持つ）", () => {
    const rows = [
      ...makeRows("new", 30).map((r) => ({ ...r, date: new Date(r.date.getTime() + 1000 * DAY_MS) })),
      ...makeRows("old", 30),
    ];
    const m = groupRecentInstancesByTemplate<Row>(rows, ["new", "old"], 30);
    expect(m.get("new")).toHaveLength(30);
    expect(m.get("old")).toHaveLength(30);
  });

  it("同日・別テンプレートの行は混ざらない", () => {
    const rows = [rowAt("a", 5, 1), rowAt("b", 5, 2)];
    const m = groupRecentInstancesByTemplate<Row>(rows, ["a", "b"], 30);
    expect(m.get("a")!.map((r) => r.id)).toEqual([1]);
    expect(m.get("b")!.map((r) => r.id)).toEqual([2]);
  });

  it("limit=0 なら全キーが空配列", () => {
    const m = groupRecentInstancesByTemplate<Row>(makeRows("a", 5), ["a"], 0);
    expect(m.get("a")).toEqual([]);
  });

  it("limit=1 なら最新1件のみ", () => {
    const m = groupRecentInstancesByTemplate<Row>(makeRows("a", 5), ["a"], 1);
    expect(m.get("a")!).toHaveLength(1);
    expect(m.get("a")![0].date.getTime()).toBe(BASE + 4 * DAY_MS);
  });

  it("入力配列を変更しない", () => {
    const rows = [rowAt("a", 3), rowAt("a", 10), rowAt("a", 1)];
    const snapshot = rows.map((r) => ({ ...r }));
    groupRecentInstancesByTemplate<Row>(rows, ["a"], 2);
    expect(rows).toEqual(snapshot);
  });

  it("旧実装（テンプレートごとに date 降順 take N）と多数のランダムパターンで完全一致する", () => {
    // 決定的な疑似乱数
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const reference = (rows: Row[], tid: string, limit: number) =>
      rows
        .filter((r) => r.templateId === tid)
        .sort((x, y) => y.date.getTime() - x.date.getTime())
        .slice(0, limit);

    for (let iter = 0; iter < 200; iter++) {
      const tids = ["t1", "t2", "t3", "t4"].slice(0, 1 + Math.floor(rnd() * 4));
      const total = Math.floor(rnd() * 120);
      let uid = 0;
      const rows: Row[] = Array.from({ length: total }, () => {
        const tid = rnd() < 0.1 ? "other" : tids[Math.floor(rnd() * tids.length)];
        // 日付は重複なし（同日同テンプレートは DB 制約でユニーク）にするため uid を使う
        return rowAt(tid, uid++ * 1 + 0, uid);
      });
      // シャッフル
      for (let i = rows.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [rows[i], rows[j]] = [rows[j], rows[i]];
      }
      const limit = [0, 1, 5, 30][Math.floor(rnd() * 4)];
      const m = groupRecentInstancesByTemplate<Row>(rows, tids, limit);
      for (const tid of tids) {
        expect(m.get(tid)).toEqual(reference(rows, tid, limit));
      }
      expect(m.has("other")).toBe(false);
    }
  });
});

describe("getMissedExposureCount — 通常タスク（carryOver=false）", () => {
  it("今日 PENDING + 過去 2 件すべて非APPROVED で 3 を返す（3日連続=即時発火境界）", () => {
    const allInstances = [
      { date: day("2026-05-09"), status: "PENDING" as const },
      { date: day("2026-05-08"), status: "PENDING" as const },
      { date: day("2026-05-07"), status: "PENDING" as const },
      { date: day("2026-05-06"), status: "APPROVED" as const },
    ];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-09"), carryOver: false }),
    ).toBe(3);
  });

  it("週次タスク: 今日(月) + 先週(月)スキップだけだと 2（まだ閾値未満）", () => {
    const allInstances = [
      { date: day("2026-05-11"), status: "PENDING" as const }, // 今週月曜
      { date: day("2026-05-04"), status: "SKIPPED" as const }, // 先週月曜
      { date: day("2026-04-27"), status: "APPROVED" as const },
    ];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-11"), carryOver: false }),
    ).toBe(2);
  });

  it("週次タスク: 3週連続非APPROVED で 3（閾値到達）", () => {
    const allInstances = [
      { date: day("2026-05-11"), status: "PENDING" as const },
      { date: day("2026-05-04"), status: "SKIPPED" as const },
      { date: day("2026-04-27"), status: "SKIPPED" as const },
      { date: day("2026-04-20"), status: "APPROVED" as const },
    ];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-11"), carryOver: false }),
    ).toBe(3);
  });

  it("APPROVED の連鎖直前で打ち切る（古い未消化 PENDING がさらに前にあっても無視）", () => {
    const allInstances = [
      { date: day("2026-05-09"), status: "PENDING" as const },
      { date: day("2026-05-08"), status: "APPROVED" as const },
      { date: day("2026-05-07"), status: "PENDING" as const }, // ここは数えない
      { date: day("2026-05-06"), status: "PENDING" as const },
    ];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-09"), carryOver: false }),
    ).toBe(1);
  });

  it("SKIPPED は連鎖を切らない（spec: スキップも放置として扱う）", () => {
    const allInstances = [
      { date: day("2026-05-09"), status: "PENDING" as const },
      { date: day("2026-05-08"), status: "SKIPPED" as const },
      { date: day("2026-05-07"), status: "SKIP_REPORTED" as const },
      { date: day("2026-05-06"), status: "REJECTED" as const },
      { date: day("2026-05-05"), status: "APPROVED" as const },
    ];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-09"), carryOver: false }),
    ).toBe(4);
  });

  it("インスタンスが空なら 0", () => {
    expect(
      getMissedExposureCount({ allInstances: [], today: day("2026-05-09"), carryOver: false }),
    ).toBe(0);
  });

  it("すべて非APPROVED（一度も完了していない新タスク）", () => {
    const allInstances = [
      { date: day("2026-05-09"), status: "PENDING" as const },
      { date: day("2026-05-08"), status: "PENDING" as const },
      { date: day("2026-05-07"), status: "PENDING" as const },
    ];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-09"), carryOver: false }),
    ).toBe(3);
  });
});

describe("getMissedExposureCount — carryOver タスク", () => {
  it("instance.date から today までの暦日数（inclusive）を返す（5/7→5/9 で 3）", () => {
    const allInstances = [
      { date: day("2026-05-07"), status: "PENDING" as const }, // carryOver で残ってる
      { date: day("2026-05-06"), status: "APPROVED" as const },
    ];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-09"), carryOver: true }),
    ).toBe(3);
  });

  it("instance.date が today と同じなら 1", () => {
    const allInstances = [{ date: day("2026-05-09"), status: "PENDING" as const }];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-09"), carryOver: true }),
    ).toBe(1);
  });

  it("APPROVED が直近の場合は 0（連鎖がない）", () => {
    const allInstances = [
      { date: day("2026-05-09"), status: "APPROVED" as const },
    ];
    expect(
      getMissedExposureCount({ allInstances, today: day("2026-05-09"), carryOver: true }),
    ).toBe(0);
  });

  it("インスタンスが空なら 0", () => {
    expect(
      getMissedExposureCount({ allInstances: [], today: day("2026-05-09"), carryOver: true }),
    ).toBe(0);
  });
});

describe("getIdleCalendarDays（UI 表示用: 最終 APPROVED からの暦日差）", () => {
  it("最終APPROVEDの日付からの経過日数（JST）を返す", () => {
    expect(
      getIdleCalendarDays({
        today: day("2026-05-09"),
        lastApprovedAt: day("2026-05-06"),
        templateCreatedAt: day("2026-04-01"),
      }),
    ).toBe(3);
  });

  it("一度もAPPROVEDされていない場合は templateCreatedAt 起点", () => {
    expect(
      getIdleCalendarDays({
        today: day("2026-05-09"),
        lastApprovedAt: null,
        templateCreatedAt: day("2026-05-05"),
      }),
    ).toBe(4);
  });

  it("未来日付がきても負数にせず 0", () => {
    expect(
      getIdleCalendarDays({
        today: day("2026-05-09"),
        lastApprovedAt: day("2026-05-10"),
        templateCreatedAt: day("2026-04-01"),
      }),
    ).toBe(0);
  });
});

describe("isEligibleForDeclaration", () => {
  it("missedExposures >= 3 かつ アクション可能ステータス（PENDING/REJECTED）なら true", () => {
    expect(isEligibleForDeclaration({ missedExposures: 3, status: "PENDING" })).toBe(true);
    expect(isEligibleForDeclaration({ missedExposures: 5, status: "REJECTED" })).toBe(true);
  });

  it("missedExposures < 3 なら false（境界 2）", () => {
    expect(isEligibleForDeclaration({ missedExposures: 2, status: "PENDING" })).toBe(false);
    expect(isEligibleForDeclaration({ missedExposures: 0, status: "PENDING" })).toBe(false);
  });

  it("既に今日アクション済みのステータスでは false", () => {
    expect(isEligibleForDeclaration({ missedExposures: 5, status: "REPORTED" })).toBe(false);
    expect(isEligibleForDeclaration({ missedExposures: 5, status: "APPROVED" })).toBe(false);
    expect(isEligibleForDeclaration({ missedExposures: 5, status: "SKIPPED" })).toBe(false);
    expect(isEligibleForDeclaration({ missedExposures: 5, status: "SKIP_REPORTED" })).toBe(false);
  });
});

describe("constants", () => {
  it("IDLE_EXPOSURE_THRESHOLD は 3", () => {
    expect(IDLE_EXPOSURE_THRESHOLD).toBe(3);
  });

  it("DECLARATION_BONUS_XP は 1", () => {
    expect(DECLARATION_BONUS_XP).toBe(1);
  });
});
