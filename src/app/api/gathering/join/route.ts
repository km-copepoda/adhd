import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { normalizeSecretWord, LOCATION_CAPACITY, type GatheringLocationType } from "@/lib/gathering";

const VALID_LOCATIONS: GatheringLocationType[] = ["PARK", "COMMUNITY_CENTER", "SCHOOL"];

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CHILD") {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { location, secretWord } = await request.json();

  if (!VALID_LOCATIONS.includes(location)) {
    return NextResponse.json({ error: "場所が正しくありません" }, { status: 400 });
  }

  const normalized = normalizeSecretWord(secretWord ?? "");
  if (!normalized || normalized.length === 0) {
    return NextResponse.json({ error: "合言葉を入れてね" }, { status: 400 });
  }

  // 既に別グループに参加中かチェック
  const existing = await prisma.gatheringMember.findUnique({
    where: { childId: user.id },
    select: { groupId: true },
  });
  if (existing) {
    return NextResponse.json({ error: "すでにグループに参加しています" }, { status: 409 });
  }

  // グループを取得または新規作成
  const group = await prisma.gatheringGroup.upsert({
    where: { location_secretWord: { location, secretWord: normalized } },
    update: {},
    create: { location, secretWord: normalized },
    include: { _count: { select: { members: true } } },
  });

  const capacity = LOCATION_CAPACITY[location as GatheringLocationType];
  if (group._count.members >= capacity) {
    return NextResponse.json({ error: "このグループは満員です" }, { status: 409 });
  }

  const member = await prisma.gatheringMember.create({
    data: { groupId: group.id, childId: user.id },
  });

  return NextResponse.json({ groupId: group.id, memberId: member.id });
}
