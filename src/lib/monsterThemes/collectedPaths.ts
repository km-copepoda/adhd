// collectedPaths (User.collectedPaths, JSON文字列配列) のテーマ名前空間対応ヘルパー。
//
// 新形式: "{themeId}:{path}" (例: "buddha:STUDY_STUDY_LIFE")
// 旧形式: 裸のパス文字列 (例: "STUDY_STUDY_LIFE")。既存ユーザーのデータ互換のため、
//         無料テーマ (dark/light) の記録として引き続き読める。
//         有料テーマ (buddha 等) は旧形式を自分の記録として読まない。

const FREE_THEME_IDS = new Set(["dark", "light"]);

function namespacedEntry(themeId: string, path: string): string {
  return `${themeId}:${path}`;
}

/** collectedPaths に指定テーマ・パスの記録が含まれているか判定する。 */
export function hasCollectedPath(
  collectedPaths: string[],
  themeId: string,
  path: string,
): boolean {
  const namespaced = namespacedEntry(themeId, path);
  if (collectedPaths.includes(namespaced)) return true;
  // 旧形式（裸のパス文字列）は無料テーマ（dark/light）の記録としてのみ読む
  if (FREE_THEME_IDS.has(themeId) && collectedPaths.includes(path)) return true;
  return false;
}

/**
 * collectedPaths に指定テーマ・パスの記録を追加する（イミュータブル）。
 * 既に旧形式（無料テーマ扱い）または新形式で記録済みなら重複追加しない。
 */
export function addCollectedPath(
  collectedPaths: string[],
  themeId: string,
  path: string,
): string[] {
  if (hasCollectedPath(collectedPaths, themeId, path)) return collectedPaths;
  return [...collectedPaths, namespacedEntry(themeId, path)];
}
