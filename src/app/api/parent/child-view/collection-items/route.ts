// 親代理（子供モード）— 子供のコレクションアイテム一覧を閲覧する。
//
// GET /api/parent/child-view/collection-items?childId=X
// レスポンス形式は /api/collection-items と同じ。
// 親モードでは閲覧専用 (所持実績は子供の本人操作で増える)。

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveTargetChild } from "@/lib/parentChildView";
import { ALL_COLLECTION_ITEMS, getCurrentSeason } from "@/lib/collectionItems";
import { getOwnedCollection } from "@/lib/collectionService";

export async function GET(request: Request) {
  const parent = await getCurrentUser();
  if (!parent) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const url = new URL(request.url);
  const childId = url.searchParams.get("childId");

  const resolved = await resolveTargetChild(parent, childId);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  const owned = await getOwnedCollection(resolved.child.id);
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
    items,
  });
}
