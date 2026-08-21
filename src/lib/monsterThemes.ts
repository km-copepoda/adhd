// モンスターテーマセットの DB 操作層（FamilyMonsterTheme テーブル）。
// データ定義層 (@/lib/monsterThemes/index, @/lib/monsterThemes/buddha) とは別ファイル。

import { prisma } from "@/lib/prisma";

/**
 * 家族にモンスターテーマの有効化を記録する（購入・付与など）。
 * familyId + themeId で upsert するため、同じテーマを複数回有効化しても
 * レコードが重複作成されることはない。兄弟間でテーマの所持を共有するため
 * childId ではなく familyId を単位とする（Issue #111）。
 */
export async function activateFamilyTheme(
  familyId: string,
  themeId: string,
  grantReason: string,
  now: Date = new Date(),
): Promise<void> {
  if (!familyId) throw new Error("familyId is required");
  if (!themeId) throw new Error("themeId is required");

  await prisma.familyMonsterTheme.upsert({
    where: { familyId_themeId: { familyId, themeId } },
    create: {
      familyId,
      themeId,
      activatedAt: now,
      grantReason,
    },
    update: {},
  });
}
