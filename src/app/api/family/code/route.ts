import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateFamilyCode } from "@/lib/categories";
import { log, routeLogger } from "@/lib/logger";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.familyId) {
      return NextResponse.json({ code: null, members: [] });
    }

    const family = await prisma.family.findUnique({
      where: { id: user.familyId },
      include: { users: { orderBy: { createdAt: "asc" } } },
    });

    const members = (family?.users || []).map((u: Record<string, unknown>) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      monsterName: u.monsterName,
      side: u.side,
      evolutionStage: u.evolutionStage ?? 0,
      evolutionPath: (u.evolutionPath as string) ?? "",
      rebirthEggBonus: (u.rebirthEggBonus as string | null) ?? null,
      childCode: u.childCode ?? null,
      minTasksForStreak: u.minTasksForStreak ?? 1,
      reportDeadlineTime: (u.reportDeadlineTime as string | null) ?? null,
    }));

    return NextResponse.json({
      code: family?.code,
      members,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error("Family code fetch failed", { route: "GET /api/family/code", error: message });
    return NextResponse.json({ code: null, members: [], error: message }, { status: 500 });
  }
}

export async function POST() {
  const rlog = routeLogger("POST", "/api/family/code");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  if (user.familyId) {
    // Regenerate code
    const family = await prisma.family.update({
      where: { id: user.familyId },
      data: { code: generateFamilyCode() },
    });
    rlog.info("Family code regenerated", { familyId: user.familyId });
    return NextResponse.json({ code: family.code });
  }

  // Create new family
  const family = await prisma.family.create({
    data: {
      code: generateFamilyCode(),
      users: { connect: { id: user.id } },
    },
  });

  return NextResponse.json({ code: family.code });
}
