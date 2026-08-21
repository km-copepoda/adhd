// 所持テーマ一覧（ownedThemes）を決定する純粋関数（ビジネスロジック層）。
//
// FamilyMonsterTheme のレコードのみから ownedThemes を構築すると、以下が漏れる:
//   - isFree: true のテーマ（dark/light）は付与レコードが無くても所持しているはず
//   - 現在有効な monsterSetId（移行直後などレコードがまだ無いケース）
// このため、以下の3種類をマージした一覧を返す。
//   - MONSTER_THEMES で isFree === true の全テーマID
//   - 現在の monsterSetId
//   - 既存の FamilyMonsterTheme レコード由来の themeId（Issue #111: 家族単位所持、兄弟間で共有）
//
// isFree: false のテーマ（buddha 等）は、FamilyMonsterTheme にレコードが無い限り含めない
// （PR #89 Codexレビュー指摘2）。

import { MONSTER_THEMES } from "@/lib/monsterThemes/index";

export function resolveOwnedThemes(
  ownedThemeRecords: { themeId: string }[] | null | undefined,
  monsterSetId: string | null | undefined,
): string[] {
  const themeIds = new Set<string>();

  for (const theme of Object.values(MONSTER_THEMES)) {
    if (theme.isFree) themeIds.add(theme.id);
  }

  if (monsterSetId) themeIds.add(monsterSetId);

  for (const record of ownedThemeRecords ?? []) {
    themeIds.add(record.themeId);
  }

  return Array.from(themeIds);
}
