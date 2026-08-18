// モンスターテーマセットの DB 操作層（ChildMonsterTheme テーブル）。
// データ定義層 (@/lib/monsterThemes/index, @/lib/monsterThemes/buddha) とは別ファイル。

import { prisma } from "@/lib/prisma";

/**
 * 子供にモンスターテーマの有効化を記録する（購入・付与など）。
 * childId + themeId で upsert するため、同じテーマを複数回有効化しても
 * レコードが重複作成されることはない。
 */
export async function activateChildTheme(
  childId: string,
  themeId: string,
  grantReason: string,
  now: Date = new Date(),
): Promise<void> {
  if (!childId) throw new Error("childId is required");
  if (!themeId) throw new Error("themeId is required");

  await prisma.childMonsterTheme.upsert({
    where: { childId_themeId: { childId, themeId } },
    create: {
      childId,
      themeId,
      activatedAt: now,
      grantReason,
    },
    update: {},
  });
}
