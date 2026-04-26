import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { LOCATION_LABEL, LOCATION_EMOJI, LOCATION_CAPACITY, type GatheringLocationType } from "@/lib/gathering";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  // 親ロールの場合: childId クエリパラメータで指定した子供のグループを返す
  let childId = user.id;
  if (user.role === "PARENT") {
    const { searchParams } = new URL(request.url);
    const qChildId = searchParams.get("childId");
    if (!qChildId) return NextResponse.json(null);

    // 自分のファミリーの子供か確認
    const child = await prisma.user.findFirst({
      where: { id: qChildId, familyId: user.familyId ?? undefined, role: "CHILD" },
      select: { id: true },
    });
    if (!child) return NextResponse.json({ error: "子供が見つかりません" }, { status: 404 });
    childId = child.id;
  }

  const member = await prisma.gatheringMember.findUnique({
    where: { childId },
    include: {
      group: {
        include: { _count: { select: { members: true } } },
      },
    },
  });

  if (!member) return NextResponse.json(null);

  const loc = member.group.location as GatheringLocationType;
  return NextResponse.json({
    groupId: member.group.id,
    location: loc,
    locationLabel: LOCATION_LABEL[loc],
    locationEmoji: LOCATION_EMOJI[loc],
    secretWord: member.group.secretWord,
    memberCount: member.group._count.members,
    capacity: LOCATION_CAPACITY[loc],
  });
}
