import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { routeLogger } from "@/lib/logger";

// POST: ファミリーコード + ユーザーコードで子どもを検証し、supabaseIdを紐付ける
export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/auth/child-rejoin");
  const { familyCode, childCode } = await request.json();

  if (!familyCode || !childCode) {
    return NextResponse.json(
      { error: "ファミリーコードとユーザーコードを入力してください" },
      { status: 400 },
    );
  }

  // サーバー側でセッションを読み取る（クライアントから ID を受け取らない）
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "認証情報がありません" }, { status: 401 });
  }

  // email がある = 親のメールアカウント → 子ども認証には使えない
  if (user.email) {
    return NextResponse.json(
      { error: "子どもアカウントでログインしてください" },
      { status: 403 },
    );
  }

  const supabaseUserId = user.id;

  // ファミリーを検索
  const family = await prisma.family.findUnique({
    where: { code: familyCode.toUpperCase() },
  });
  if (!family) {
    rlog.warn("Family not found on rejoin");
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
    rlog.warn("Child not found on rejoin", { familyId: family.id });
    return NextResponse.json({ error: "コードが正しくありません" }, { status: 404 });
  }

  // 同じsupabaseIdが他の子どもに紐付いている場合は先に解除
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { supabaseId: supabaseUserId, id: { not: child.id }, role: "CHILD" },
      data: { supabaseId: `detached_${Date.now()}` },
    }),
    prisma.user.update({
      where: { id: child.id },
      data: { supabaseId: supabaseUserId },
    }),
  ]);

  rlog.info("Child rejoin success", { childId: child.id, familyId: family.id });
  return NextResponse.json({
    userId: child.id,
    monsterName: child.monsterName,
    side: child.side,
  });
}
