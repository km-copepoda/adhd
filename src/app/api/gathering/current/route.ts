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
    // familyId 必須: `?? undefined` にすると WHERE 句が無効化される (IDOR)
    if (!user.familyId) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }
    const { searchParams } = new URL(request.url);
    const qChildId = searchParams.get("childId");
    if (!qChildId) return NextResponse.json(null);

    // 自分のファミリーの子供か確認
    const child = await prisma.user.findFirst({
      where: { id: qChildId, familyId: user.familyId, role: "CHILD" },
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
      monsterName: string | null;
      evolutionStage: number;
      evolutionPath: string;
      side: string | null;
    };
  };

  const members = (member.group.members as MemberRow[]).map((m) => {
    const monster = getMonsterStage(m.child.evolutionStage, m.child.evolutionPath, m.child.side);
    const monsterName = m.child.monsterName ?? monster.name;
    // 本名 (User.name) はプライバシー保護のため API レスポンスに含めない（decisions.md 2026-04-26 / 2026-05-09）
    return {
      id: m.child.id,
      monsterName,
      speciesName: monster.name,
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
