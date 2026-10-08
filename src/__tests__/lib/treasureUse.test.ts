// #151: ごほうび使用申請の状態遷移バリデータ（純粋関数）。
//
// 許可される遷移:
//   UNUSED        -> USE_REQUESTED   (canRequestUse) 子が申請
//   USE_REQUESTED -> USED            (canApproveUse) 親が承認
//   USE_REQUESTED -> UNUSED          (canRejectUse)  親が却下
//   USED          -> UNUSED          (canRevokeUse)  親が巻き戻し
//
// 上記以外は全て false（DB操作を含まない純粋関数、API 側は false を 400 に変換する）。

import { describe, it, expect } from "vitest";
import {
  canRequestUse,
  canApproveUse,
  canRejectUse,
  canRevokeUse,
  canUseByParent,
  deriveUseStatusFromLegacy,
} from "@/lib/treasureUse";
import type { TreasureUseStatus } from "@/generated/prisma/client";

const ALL_STATUSES: TreasureUseStatus[] = ["UNUSED", "USE_REQUESTED", "USED"];

describe("canRequestUse (UNUSED -> USE_REQUESTED)", () => {
  it("UNUSED からは申請できる", () => {
    expect(canRequestUse("UNUSED")).toBe(true);
  });

  it("USE_REQUESTED からは申請できない（二重申請拒否）", () => {
    expect(canRequestUse("USE_REQUESTED")).toBe(false);
  });

  it("USED からは申請できない", () => {
    expect(canRequestUse("USED")).toBe(false);
  });
});

describe("canApproveUse (USE_REQUESTED -> USED)", () => {
  it("USE_REQUESTED からは承認できる", () => {
    expect(canApproveUse("USE_REQUESTED")).toBe(true);
  });

  it("UNUSED からは承認できない（UNUSED->USED の直接遷移を拒否）", () => {
    expect(canApproveUse("UNUSED")).toBe(false);
  });

  it("USED からは承認できない（二重承認拒否）", () => {
    expect(canApproveUse("USED")).toBe(false);
  });
});

describe("canRejectUse (USE_REQUESTED -> UNUSED)", () => {
  it("USE_REQUESTED からは却下できる", () => {
    expect(canRejectUse("USE_REQUESTED")).toBe(true);
  });

  it("UNUSED からは却下できない", () => {
    expect(canRejectUse("UNUSED")).toBe(false);
  });

  it("USED からは却下できない（USED->USE_REQUESTED も不可）", () => {
    expect(canRejectUse("USED")).toBe(false);
  });
});

describe("canRevokeUse (USED -> UNUSED)", () => {
  it("USED からは巻き戻しできる", () => {
    expect(canRevokeUse("USED")).toBe(true);
  });

  it("USE_REQUESTED からは巻き戻しできない（親のみ・USED限定）", () => {
    expect(canRevokeUse("USE_REQUESTED")).toBe(false);
  });

  it("UNUSED からは巻き戻しできない", () => {
    expect(canRevokeUse("UNUSED")).toBe(false);
  });
});

describe("網羅性: 許可される遷移は4パターンのみ", () => {
  it.each(ALL_STATUSES)("各バリデータは %s に対して boolean を返す", (status) => {
    expect(typeof canRequestUse(status)).toBe("boolean");
    expect(typeof canApproveUse(status)).toBe("boolean");
    expect(typeof canRejectUse(status)).toBe("boolean");
    expect(typeof canRevokeUse(status)).toBe("boolean");
  });

  it("UNUSED -> USED の直接遷移はどのバリデータからも許可されない", () => {
    // canRequestUse は USE_REQUESTED への遷移なので USED は対象外、
    // canApproveUse(UNUSED) が唯一 UNUSED->USED を意味しうる呼び出しだが false であること
    expect(canApproveUse("UNUSED")).toBe(false);
  });
});

// ─── #151: 既存データ互換（マイグレーションのバックフィル方針と同じ導出ロジック） ─────
// prisma/migrations/20260925000001_add_treasure_use_status/migration.sql の
// バックフィル SQL と同じ判定を純粋関数として表現する（テスト容易性のため）。
//   fulfilled=true  AND itemId!=null -> USED
//   itemId===null（コレクション獲得）  -> 常に UNUSED（fulfilledの値に関わらず）
//   それ以外（fulfilled=false）        -> UNUSED
describe("deriveUseStatusFromLegacy（マイグレーション後の状態）", () => {
  it("fulfilled=true かつ itemId!=null -> USED", () => {
    expect(deriveUseStatusFromLegacy(true, "item-1")).toBe("USED");
  });

  it("fulfilled=false かつ itemId!=null -> UNUSED", () => {
    expect(deriveUseStatusFromLegacy(false, "item-1")).toBe("UNUSED");
  });

  it("itemId===null（コレクション獲得）は fulfilled=true でも UNUSED 固定", () => {
    expect(deriveUseStatusFromLegacy(true, null)).toBe("UNUSED");
  });

  it("itemId===null（コレクション獲得）は fulfilled=false でも UNUSED", () => {
    expect(deriveUseStatusFromLegacy(false, null)).toBe("UNUSED");
  });
});

// ─── #164: 親が承認なしで直接「使用済み」にする ─────────────────────
//   UNUSED        -> USED (canUseByParent) 親が直接使用
//   USE_REQUESTED -> USED (canUseByParent) 申請済みでも親が直接使用
//   USED          -> USED は不可（二重使用拒否）
describe("canUseByParent (UNUSED | USE_REQUESTED -> USED) #164", () => {
  it("UNUSED からは親が直接使用できる", () => {
    expect(canUseByParent("UNUSED")).toBe(true);
  });

  it("USE_REQUESTED からも親が直接使用できる", () => {
    expect(canUseByParent("USE_REQUESTED")).toBe(true);
  });

  it("USED からは使用できない（二重使用拒否）", () => {
    expect(canUseByParent("USED")).toBe(false);
  });

  it("既存バリデータ canApproveUse(UNUSED) は false のまま（承認の契約は変えない）", () => {
    expect(canApproveUse("UNUSED")).toBe(false);
  });
});
