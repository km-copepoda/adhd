import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { sendPushToParent } from "@/lib/push";
import { routeLogger } from "@/lib/logger";
import { triggerTaskProgressLog } from "@/lib/bulletinLog";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rlog = routeLogger("POST", "/api/quests/[id]/skip");
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
    include: { template: true },
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

  // 親に通知
  if (user.familyId) {
    const parent = await prisma.user.findFirst({
      where: { familyId: user.familyId, role: "PARENT" },
    });
    if (parent) {
      const childName = user.monsterName ?? user.name ?? "子供";
      const questTitle = quest.snapshotTitle ?? quest.template.title;
      await sendPushToParent(parent.id, {
        title: "😴 スキップ申請",
        body: `${childName}が「${questTitle}」のスキップを申請しました`,
        url: "/app/parent/approve",
      });
    }
  }

  // 掲示板ログ — スキップも「done」扱いなので進捗を再評価する。after() でレスポンス後実行
  after(() => triggerTaskProgressLog(user.id).catch(() => {}));

  rlog.info("Skip requested", { questId: id, childId: user.id });
  return NextResponse.json({ ok: true });
}
