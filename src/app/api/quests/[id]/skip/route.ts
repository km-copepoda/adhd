import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const commentText = typeof body.comment === "string" ? body.comment.trim() : "";

  if (!commentText) {
    return NextResponse.json({ error: "スキップ理由を入力してください" }, { status: 400 });
  }

  const { id } = await params;

  const quest = await prisma.questInstance.findUnique({
    where: { id, childId: user.id },
  });

  if (!quest) {
    return NextResponse.json({ error: "クエストが見つかりません" }, { status: 404 });
  }

  if (quest.status !== "PENDING") {
    return NextResponse.json({ error: "PENDINGのクエストのみスキップできます" }, { status: 400 });
  }

  await prisma.questInstance.update({
    where: { id },
    data: { status: "SKIP_REPORTED", comment: commentText, reportedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
