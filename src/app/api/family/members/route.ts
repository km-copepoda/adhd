import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateChildCode } from "@/lib/constants";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { monsterName, side } = await request.json();
  if (!monsterName || !side) {
    return NextResponse.json({ error: "名前とサイドを入力してください" }, { status: 400 });
  }

  // Generate unique child code within the family
  let childCode: string | null = null;
  for (let i = 0; i < 10; i++) {
    const candidate = generateChildCode();
    const existing = await prisma.user.findUnique({
      where: { familyId_childCode: { familyId: user.familyId, childCode: candidate } },
    });
    if (!existing) {
      childCode = candidate;
      break;
    }
  }
  if (!childCode) {
    return NextResponse.json({ error: "コード生成に失敗しました。再度お試しください" }, { status: 500 });
  }

  // Create child user with a placeholder supabaseId (will be updated on first login)
  const child = await prisma.user.create({
    data: {
      supabaseId: `pending_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      role: "CHILD",
      monsterName,
      side,
      familyId: user.familyId,
      childCode,
    },
  });

  return NextResponse.json({
    id: child.id,
    monsterName: child.monsterName,
    side: child.side,
    childCode: child.childCode,
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { childId, minTasksForStreak } = await request.json();
  if (!childId || typeof minTasksForStreak !== "number" || minTasksForStreak < 1) {
    return NextResponse.json({ error: "childIdと1以上のminTasksForStreakが必要です" }, { status: 400 });
  }

  // 同じファミリーの子供か確認
  const child = await prisma.user.findFirst({
    where: { id: childId, familyId: user.familyId, role: "CHILD" },
  });
  if (!child) {
    return NextResponse.json({ error: "子供が見つかりません" }, { status: 404 });
  }

  await prisma.user.update({
    where: { id: childId },
    data: { minTasksForStreak },
  });

  return NextResponse.json({ ok: true });
}
