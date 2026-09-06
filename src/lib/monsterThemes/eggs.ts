// 転生卵選択ボーナス（STUDY/STAMINA/LIFE）の画像解決ロジック（データ定義+純粋関数）。
// Issue #115 で buddha テーマに「いしのたまご」を割り当てる案を実装したが、
// 石卵4種（STUDY/STAMINA/LIFE/通常）が並ぶと視認性が悪いため Issue #119 で撤回し、
// カテゴリ卵は dark/light と同じ既定の色卵に戻した（通常卵＝いしのたまごは維持）。
// 現状 rebirthEggImages を定義しているテーマは無く、monsterSetId 引数を使った
// テーマ別分岐（下記 theme?.rebirthEggImages?.[eggType]）は実質発火しないが、
// 将来テーマ別のカテゴリ卵アセットを追加する場合の拡張点として意図的に残している
// （デッドコードではない。@/lib/monsterThemes/index の rebirthEggImages 型定義も参照）。
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
