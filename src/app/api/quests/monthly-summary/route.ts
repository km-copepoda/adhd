import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calcActualXP } from "@/lib/xpRange";

function formatDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

const emptyResponse = { days: {}, achievedDays: 0, totalApproved: 0, totalXp: 0 };

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json(emptyResponse);
  }

  const { searchParams } = new URL(request.url);
  const yearStr = searchParams.get("year");
  const monthStr = searchParams.get("month");
  const childId = searchParams.get("childId");

  if (!yearStr || !monthStr || !childId) {
    return NextResponse.json({ error: "year, month, childId は必須です" }, { status: 400 });
  }

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-based

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "year/month が不正です" }, { status: 400 });
  }

  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 1)); // exclusive

  const instances = await prisma.questInstance.findMany({
    where: {
      childId,
      date: { gte: monthStart, lt: monthEnd },
      template: { familyId: user.familyId },
      status: { in: ["APPROVED", "SKIPPED"] },
    },
    select: {
      date: true,
      status: true,
      deadlineBonusEarned: true,
      photoUrl: true,
      template: { select: { photoBonus: true } },
    },
  });

  const days: Record<string, { approved: number; skipped: number }> = {};
  let totalApproved = 0;
  let totalXp = 0;

  for (const inst of instances) {
    const dateStr = formatDate(inst.date);
    if (!days[dateStr]) days[dateStr] = { approved: 0, skipped: 0 };
    if (inst.status === "APPROVED") {
      days[dateStr].approved++;
      totalApproved++;
      totalXp += calcActualXP(inst.deadlineBonusEarned, inst.template.photoBonus, !!inst.photoUrl);
    } else {
      days[dateStr].skipped++;
    }
  }

  const achievedDays = Object.values(days).filter((d) => d.approved >= 1).length;

  return NextResponse.json({ days, achievedDays, totalApproved, totalXp });
}
