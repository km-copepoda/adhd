import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { LOCATION_LABEL, LOCATION_EMOJI, LOCATION_CAPACITY, type GatheringLocationType } from "@/lib/gathering";
import { getMonsterStage } from "@/lib/monsters";

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
        include: {
          _count: { select: { members: true } },
          members: {
            include: {
              child: {
                select: {
                  id: true,
                  name: true,
                  monsterName: true,
                  evolutionStage: true,
                  evolutionPath: true,
                  side: true,
                },
              },
            },
            orderBy: { joinedAt: "asc" },
          },
        },
      },
    },
  });

  if (!member) return NextResponse.json(null);

  const loc = member.group.location as GatheringLocationType;

  type MemberRow = {
    child: {
      id: string;
      name: string | null;
      monsterName: string | null;
      evolutionStage: number;
      evolutionPath: string;
      side: string | null;
    };
  };

  const members = (member.group.members as MemberRow[]).map((m) => {
    const monster = getMonsterStage(m.child.evolutionStage, m.child.evolutionPath, m.child.side);
    return {
      id: m.child.id,
      name: m.child.name ?? "なまえなし",
      monsterName: m.child.monsterName ?? monster.name,
      monsterImage: monster.image,
      evolutionStage: m.child.evolutionStage,
      isMe: user.role === "CHILD" && m.child.id === user.id,
    };
  });

  return NextResponse.json({
    groupId: member.group.id,
    location: loc,
    locationLabel: LOCATION_LABEL[loc],
    locationEmoji: LOCATION_EMOJI[loc],
    secretWord: member.group.secretWord,
    memberCount: member.group._count.members,
    capacity: LOCATION_CAPACITY[loc],
    members,
  });
}
