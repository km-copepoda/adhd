// monsterLevels (User.monsterLevels, JSON文字列 {path: count} 形式) のテーマ名前空間対応ヘルパー。
//
// 新形式: "{themeId}:{path}" (例: "buddha:STUDY_STUDY_STUDY")
// 旧形式: 裸のパス文字列 (例: "STUDY_STUDY_STUDY")。既存ユーザーのデータ互換のため、
//         無料テーマ (dark/light) の記録として引き続き読める。
//         有料テーマ (buddha 等) は旧形式を自分の記録として読まない。
//
// @/lib/monsterThemes/collectedPaths.ts と同じ設計思想。

const FREE_THEME_IDS = new Set(["dark", "light"]);

function namespacedKey(themeId: string, path: string): string {
  return `${themeId}:${path}`;
}

/** monsterLevels から指定テーマ・パスの stage3 到達カウントを取得する。 */
export function getMonsterLevel(
  monsterLevels: Record<string, number>,
  themeId: string,
  path: string,
): number {
  const namespaced = namespacedKey(themeId, path);
  if (namespaced in monsterLevels) return monsterLevels[namespaced];
  // 旧形式（裸のパス文字列）は無料テーマ（dark/light）の記録としてのみ読む
  if (FREE_THEME_IDS.has(themeId) && path in monsterLevels) return monsterLevels[path];
  return 0;
}

/**
 * monsterLevels に指定テーマ・パスの stage3 到達カウントを +1 する（イミュータブル）。
 * 新形式キーが既にあればその値に+1。無ければ getMonsterLevel で読める既存値
 * （旧形式含む）を引き継いで+1した値を新形式キーとして保存する。
 * 旧形式キーはそのまま残す。
 */
export function incrementMonsterLevel(
  monsterLevels: Record<string, number>,
  themeId: string,
  path: string,
): Record<string, number> {
  const namespaced = namespacedKey(themeId, path);
  const current = getMonsterLevel(monsterLevels, themeId, path);
  return { ...monsterLevels, [namespaced]: current + 1 };
}
