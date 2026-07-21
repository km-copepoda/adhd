// 子供用 — コレクションアイテム一覧 (マスター + 所持状況)
//
// GET /api/collection-items
// 戻り値:
//   {
//     currentSeason: "spring" | "summer" | "fall" | "winter",
//     currentMonth: 1..12 (JST),
//     items: Array<{ ...マスター項目, month?, owned, count, firstAcquiredAt, lastAcquiredAt }>,
//   }
// マスターは全 140 種 (通常 80 + 月限定 60) を返し、各アイテムに所持実績を付与する。
// 子画面 ItemsContent ではシーズン別に表示する (現在シーズンをデフォルトタブ、
// 現在月の限定アイテムを最上部に固定表示)。

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  ALL_COLLECTION_ITEMS,
  getCurrentMonth,
  getCurrentSeason,
} from "@/lib/collectionItems";
import { getOwnedCollection } from "@/lib/collectionService";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CHILD") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const owned = await getOwnedCollection(user.id);
  const ownedMap = new Map(owned.map((r) => [r.itemId, r]));

  const items = ALL_COLLECTION_ITEMS.map((m) => {
    const rec = ownedMap.get(m.id);
    return {
      ...m,
      owned: !!rec,
      count: rec?.count ?? 0,
      firstAcquiredAt: rec?.firstAcquiredAt.toISOString() ?? null,
      lastAcquiredAt: rec?.lastAcquiredAt.toISOString() ?? null,
    };
  });

  return NextResponse.json({
    currentSeason: getCurrentSeason(),
    currentMonth: getCurrentMonth(),
    items,
  });
}
