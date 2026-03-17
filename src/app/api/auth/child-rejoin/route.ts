import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// POST: ファミリーコード + ユーザーコードで子どもを検証し、supabaseIdを紐付ける
export async function POST(request: Request) {
  const { familyCode, childCode, supabaseUserId } = await request.json();

  if (!familyCode || !childCode) {
    return NextResponse.json(
      { error: "ファミリーコードとユーザーコードを入力してください" },
      { status: 400 },
    );
  }

  if (!supabaseUserId) {
    return NextResponse.json(
      { error: "認証情報がありません" },
      { status: 400 },
    );
  }

  // ファミリーを検索
  const family = await prisma.family.findUnique({
    where: { code: familyCode.toUpperCase() },
  });
  if (!family) {
    return NextResponse.json({ error: "コードが正しくありません" }, { status: 404 });
  }

  // ファミリーコード + ユーザーコードの組み合わせで子どもを特定
  const child = await prisma.user.findUnique({
    where: {
      familyId_childCode: {
        familyId: family.id,
        childCode: childCode,
      },
    },
  });
  if (!child || child.role !== "CHILD") {
    return NextResponse.json({ error: "コードが正しくありません" }, { status: 404 });
  }

  // supabaseId をクライアント側で取得した匿名セッションに更新
  // 同じsupabaseIdが他ユーザーに紐付いている場合（同デバイスで別の子がログイン済み等）は先に解除
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { supabaseId: supabaseUserId, id: { not: child.id } },
      data: { supabaseId: `detached_${Date.now()}` },
    }),
    prisma.user.update({
      where: { id: child.id },
      data: { supabaseId: supabaseUserId },
    }),
  ]);

  return NextResponse.json({
    userId: child.id,
    monsterName: child.monsterName,
    side: child.side,
  });
}
