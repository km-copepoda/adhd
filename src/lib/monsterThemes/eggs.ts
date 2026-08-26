// 転生卵選択ボーナス（STUDY/STAMINA/LIFE）の画像解決ロジック（データ定義+純粋関数）。
// Issue #115: buddha テーマでは「いしのたまご」に、rebirthEggImages を持たないテーマ
// （dark/light）は既定の固定パスにフォールバックする。
//
// NOTE: MONSTER_THEMES は @/lib/monsterThemes/index からのみインポートする
// （buddha.ts からの循環インポートを避けるため、この方向の依存のみを許可する）。

import { MONSTER_THEMES } from "@/lib/monsterThemes/index";

export type RebirthEggType = "STUDY" | "STAMINA" | "LIFE";

export const DEFAULT_REBIRTH_EGG_IMAGES: Record<RebirthEggType, string> = {
  STUDY: "/monsters/egg-study.webp",
  STAMINA: "/monsters/egg-stamina.webp",
  LIFE: "/monsters/egg-life.webp",
};

const REBIRTH_EGG_TYPES = new Set<RebirthEggType>(["STUDY", "STAMINA", "LIFE"]);

function isRebirthEggType(value: string | null | undefined): value is RebirthEggType {
  return !!value && REBIRTH_EGG_TYPES.has(value as RebirthEggType);
}

/**
 * 転生卵選択ボーナスの画像パスを解決する。
 * - eggType が STUDY/STAMINA/LIFE 以外（null/undefined/NORMAL/未知の文字列）なら null。
 * - monsterSetId が未知/null/undefined なら dark 相当（既定マップ）にフォールバックする。
 * - テーマに rebirthEggImages が定義されていればそれを、なければ既定マップを返す。
 */
export function getRebirthEggImage(
  eggType: string | null | undefined,
  monsterSetId: string | null | undefined
): string | null {
  if (!isRebirthEggType(eggType)) return null;

  const theme = monsterSetId ? MONSTER_THEMES[monsterSetId] : undefined;
  return theme?.rebirthEggImages?.[eggType] ?? DEFAULT_REBIRTH_EGG_IMAGES[eggType];
}
