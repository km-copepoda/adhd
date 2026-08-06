// 親用 — 宝箱プールアイテムの編集・削除（ソフトデリート）
//
// PUT    /api/treasures/[id] — 編集（title / rarity / sortOrder / isActive）
// DELETE /api/treasures/[id] — ソフト削除（isActive=false）。履歴に残った宝箱の参照は保持

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import type { TreasureRarity } from "@/lib/treasure";
import { getFamilyPlan } from "@/lib/subscriptionService";
import { checkLimit } from "@/lib/subscription";

const VALID_RARITIES = new Set(["COMMON", "UNCOMMON", "RARE"]);

async function fetchOwnItem(parentFamilyId: string | null, itemId: string) {
  if (!parentFamilyId) return null;
  return prisma.treasureItem.findFirst({
    where: { id: itemId, child: { familyId: parentFamilyId } },
    select: { id: true, childId: true, title: true, rarity: true, isActive: true, sortOrder: true },
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rlog = routeLogger("PUT", "/api/treasures/[id]");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const item = await fetchOwnItem(user.familyId, id);
  if (!item) {
    return NextResponse.json({ error: "アイテムが見つかりません" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const data: {
    title?: string;
    rarity?: TreasureRarity;
    sortOrder?: number;
    isActive?: boolean;
  } = {};

  if (typeof body.title === "string") {
    const t = body.title.trim();
    if (!t || t.length > 100) {
      return NextResponse.json({ error: "タイトルが不正です" }, { status: 400 });
    }
    data.title = t;
  }
  if (body.rarity !== undefined) {
    if (!VALID_RARITIES.has(body.rarity)) {
      return NextResponse.json({ error: "レア度が不正です" }, { status: 400 });
    }
    data.rarity = body.rarity as TreasureRarity;
  }
  if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "更新項目がありません" }, { status: 400 });
  }

  // 非アクティブ → アクティブへの再アクティブ化は「新規追加」と同等の上限チェックを行う。
  // 仕様: monetization-plan.md §4.4 (「ごほうび追加」列と揃える)
  if (data.isActive === true && item.isActive === false) {
    const plan = await getFamilyPlan(user.familyId!);
    const activeCount = await prisma.treasureItem.count({
      where: { childId: item.childId, isActive: true },
    });
    const limitCheck = checkLimit(plan, "treasure_item", activeCount);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: `無料プランではごほうびは${limitCheck.limit}個までです。プレミアムプランで無制限になります。`,
          code: "PLAN_LIMIT_EXCEEDED",
          resource: "treasure_item",
          current: limitCheck.current,
          limit: limitCheck.limit,
        },
        { status: 403 },
      );
    }
  }

  const updated = await prisma.treasureItem.update({
    where: { id },
    data,
    select: { id: true, title: true, rarity: true, sortOrder: true, isActive: true },
  });

  rlog.info("Treasure item updated", { parentId: user.id, itemId: id });
  return NextResponse.json({ ok: true, item: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rlog = routeLogger("DELETE", "/api/treasures/[id]");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  const item = await fetchOwnItem(user.familyId, id);
  if (!item) {
    return NextResponse.json({ error: "アイテムが見つかりません" }, { status: 404 });
  }

  // ソフトデリート: 過去の TreasureLog からの参照を維持しつつプール対象外に
  await prisma.treasureItem.update({
    where: { id },
    data: { isActive: false },
  });

  rlog.info("Treasure item soft-deleted", { parentId: user.id, itemId: id });
  return NextResponse.json({ ok: true });
}
