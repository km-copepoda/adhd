// 親用 — 宝箱（ごほうび）プールの一覧取得・追加
//
// GET  /api/treasures?childId=X — 指定子供のプール一覧（親のみ、自家族の子供に限る）
// POST /api/treasures            — アイテム追加（親のみ）

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import type { TreasureRarity } from "@/lib/treasure";

const VALID_RARITIES = new Set(["COMMON", "UNCOMMON", "RARE"]);

async function ensureFamilyChild(parentFamilyId: string | null, childId: string) {
  if (!parentFamilyId) return null;
  const child = await prisma.user.findFirst({
    where: { id: childId, role: "CHILD", familyId: parentFamilyId },
    select: { id: true },
  });
  return child;
}

export async function GET(request: Request) {
  const rlog = routeLogger("GET", "/api/treasures");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const childId = searchParams.get("childId");
  if (!childId) {
    return NextResponse.json({ error: "childId が必要です" }, { status: 400 });
  }

  const child = await ensureFamilyChild(user.familyId, childId);
  if (!child) {
    return NextResponse.json({ error: "対象の子供が見つかりません" }, { status: 404 });
  }

  const items = await prisma.treasureItem.findMany({
    where: { childId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      rarity: true,
      sortOrder: true,
      isActive: true,
      createdAt: true,
    },
  });

  rlog.info("Treasure pool fetched", { parentId: user.id, childId, count: items.length });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/treasures");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const childId = typeof body.childId === "string" ? body.childId : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const rarity = body.rarity as TreasureRarity;

  if (!childId || !title || !VALID_RARITIES.has(rarity)) {
    return NextResponse.json({ error: "入力値が不正です" }, { status: 400 });
  }
  if (title.length > 100) {
    return NextResponse.json({ error: "タイトルは100文字以内です" }, { status: 400 });
  }

  const child = await ensureFamilyChild(user.familyId, childId);
  if (!child) {
    return NextResponse.json({ error: "対象の子供が見つかりません" }, { status: 404 });
  }

  const item = await prisma.treasureItem.create({
    data: { childId, title, rarity },
    select: { id: true, title: true, rarity: true, sortOrder: true, isActive: true },
  });

  rlog.info("Treasure item created", { parentId: user.id, childId, itemId: item.id });
  return NextResponse.json({ ok: true, item });
}
