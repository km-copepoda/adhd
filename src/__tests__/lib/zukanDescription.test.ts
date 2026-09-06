// Issue #94: モンスター図鑑のタップで説明文を表示する（純粋関数ロジック）
//
// 対象（新規・未実装）: src/lib/zukanDescription.ts
//   - S3_DESCRIPTION_UNLOCK_LEVEL: number（= 3。stage3 説明文の解放閾値を1箇所に集約）
//   - isDescriptionUnlocked(path: string, level: number): boolean
//       path のセグメント数（"_" 区切り）で stage を判定する。
//         - セグメント数 1 or 2（stage1 / stage2）: level に関わらず常に true
//         - セグメント数 3（stage3）: level >= S3_DESCRIPTION_UNLOCK_LEVEL なら true
//       level は getMonsterLevel(monsterLevels, themeId, path) で解決済みの数値を渡す前提。
//       異常値（負値・NaN）でも例外を投げず false 側に倒す。
//
// モジュール未作成のため、この時点では import 解決に失敗して Red になる想定。

import { describe, it, expect } from "vitest";
import {
  S3_DESCRIPTION_UNLOCK_LEVEL,
  isDescriptionUnlocked,
} from "@/lib/zukanDescription";

describe("zukanDescription", () => {
  describe("S3_DESCRIPTION_UNLOCK_LEVEL", () => {
    it("stage3 説明文の解放閾値は 3 に集約されている", () => {
      expect(S3_DESCRIPTION_UNLOCK_LEVEL).toBe(3);
    });
  });

  describe("isDescriptionUnlocked", () => {
    it("stage1（セグメント数1）は level 0 でも解放される", () => {
      expect(isDescriptionUnlocked("STUDY", 0)).toBe(true);
    });

    it("stage2（セグメント数2）は level 0 でも解放される", () => {
      expect(isDescriptionUnlocked("STUDY_STAMINA", 0)).toBe(true);
    });

    it("境界値: stage3 は level 2（閾値-1）では未解放", () => {
      expect(isDescriptionUnlocked("STUDY_STAMINA_LIFE", 2)).toBe(false);
    });

    it("境界値: stage3 は level 3（閾値ちょうど）で解放", () => {
      expect(isDescriptionUnlocked("STUDY_STAMINA_LIFE", 3)).toBe(true);
    });

    it("境界値: stage3 は level 4（閾値+1）で解放", () => {
      expect(isDescriptionUnlocked("STUDY_STAMINA_LIFE", 4)).toBe(true);
    });

    it("stage3 は level 0 では未解放", () => {
      expect(isDescriptionUnlocked("STUDY_STAMINA_LIFE", 0)).toBe(false);
    });

    it("異常値: stage3 で level が負値(-1)でも例外を投げず false", () => {
      expect(() => isDescriptionUnlocked("STUDY_STAMINA_LIFE", -1)).not.toThrow();
      expect(isDescriptionUnlocked("STUDY_STAMINA_LIFE", -1)).toBe(false);
    });

    it("異常値: stage3 で level が NaN でも例外を投げず false", () => {
      expect(() => isDescriptionUnlocked("STUDY_STAMINA_LIFE", Number.NaN)).not.toThrow();
      expect(isDescriptionUnlocked("STUDY_STAMINA_LIFE", Number.NaN)).toBe(false);
    });
  });
});
