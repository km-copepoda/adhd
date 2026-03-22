import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { XP_MAP } from "@/lib/constants";
import { sendPushToParent } from "@/lib/push";
import { routeLogger } from "@/lib/logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rlog = routeLogger("POST", "/api/quests/[id]/report");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id } = await params;
  const { comment, photoUrl } = await request.json();

  // クエストとテンプレート情報を取得
  const quest = await prisma.questInstance.findUnique({
    where: { id, childId: user.id },
    include: { template: true },
  });
  if (!quest) {
    return NextResponse.json({ error: "クエストが見つかりません" }, { status: 404 });
  }

  if (quest.template.requirePhoto && !photoUrl) {
    return NextResponse.json({ error: "このタスクには写真が必要です" }, { status: 400 });
  }

  const xp = XP_MAP[quest.template.difficulty];
  const category = quest.template.category;

  // ステータスのみ更新（ポイント付与は承認時に行う）。再報告時は差し戻し理由をクリア
  await prisma.questInstance.update({
    where: { id },
    data: { status: "REPORTED", comment, photoUrl: photoUrl ?? null, reportedAt: new Date(), rejectionReason: null },
  });

  // 親に通知
  if (user.familyId) {
    const parent = await prisma.user.findFirst({
      where: { familyId: user.familyId, role: "PARENT" },
    });
    if (parent) {
      const childName = user.monsterName ?? user.name ?? "子供";
      await sendPushToParent(parent.id, {
        title: "✅ クエスト報告",
        body: `${childName}が「${quest.template.title}」を完了しました`,
        url: "/parent/approve",
      });
    }
  }

  rlog.info("Quest reported", { questId: id, childId: user.id, xp, category });
  return NextResponse.json({ ok: true, xpAdded: xp, category });
}
