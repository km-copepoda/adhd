// 図鑑の説明文（description）解放判定（ロジック層。DB 依存なし・副作用なし）。
//
// stage は進化パス文字列（"_" 区切り）のセグメント数で判定する。
//   - stage1 / stage2（セグメント数 1 or 2）: 収集済みなら無条件で説明を表示（level 不問）
//   - stage3（セグメント数 3）: 到達カウント（level）が S3_DESCRIPTION_UNLOCK_LEVEL 以上で解放
//
// level は getMonsterLevel(monsterLevels, themeId, path) で解決済みの数値を渡す前提。
// 異常値（負値・NaN）でも例外を投げず false 側に倒す。

/** stage3 説明文の解放閾値（到達カウント）。 */
export const S3_DESCRIPTION_UNLOCK_LEVEL = 3;

/** 進化パスのセグメント数から stage（1〜3）を返す。 */
function stageOf(path: string): number {
  return path.split("_").length;
}

/**
 * 図鑑モーダルで説明文を表示してよいかを判定する。
 * @param path  進化パス文字列（例: "STUDY_STAMINA_LIFE"）
 * @param level stage3 の到達カウント（getMonsterLevel で解決済みの数値）
 */
export function isDescriptionUnlocked(path: string, level: number): boolean {
  if (stageOf(path) < 3) return true;
  if (!Number.isFinite(level)) return false;
  return level >= S3_DESCRIPTION_UNLOCK_LEVEL;
}

/** 未解放 stage3 で説明文の代わりに表示する解放条件ヒント文言。 */
export function s3DescriptionLockedHint(): string {
  return `Lv${S3_DESCRIPTION_UNLOCK_LEVEL}になると せつめいが よめるよ！`;
}
