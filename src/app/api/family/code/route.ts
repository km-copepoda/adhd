import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { generateFamilyCode } from "@/lib/codeGenerator";
import { log, routeLogger } from "@/lib/logger";
import { isUniqueViolation } from "@/lib/prismaErrors";
import { resolveOwnedThemes } from "@/lib/monsterThemes/ownedThemes";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !user.familyId) {
      return NextResponse.json({ code: null, members: [] });
    }

    const [family, ownedThemeRecords] = await Promise.all([
      prisma.family.findUnique({
        where: { id: user.familyId },
        include: {
          users: {
            orderBy: { createdAt: "asc" },
            include: {
              streak: { select: { lastLoginDate: true } },
            },
          },
        },
      }),
      prisma.familyMonsterTheme.findMany({ where: { familyId: user.familyId } }),
    ]);

    // CHILD には自分の行だけを返す（家族コード・兄弟の情報を渡さない）。（#184）
    const isParent = user.role === "PARENT";
    const visibleUsers = (family?.users || []).filter(
      (u: { id: string }) => isParent || u.id === user.id,
    );

    const members = visibleUsers.map((u: Record<string, unknown>) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      monsterName: u.monsterName,
      side: u.side,
      evolutionStage: u.evolutionStage ?? 0,
      evolutionPath: (u.evolutionPath as string) ?? "",
      rebirthEggBonus: (u.rebirthEggBonus as string | null) ?? null,
      rebirthPending: (u.rebirthPending as boolean | undefined) ?? false,
      minTasksForStreak: u.minTasksForStreak ?? 1,
      reportDeadlineTime: (u.reportDeadlineTime as string | null) ?? null,
      checkinDeadlineTime: (u.checkinDeadlineTime as string | null) ?? null,
      questTimeNotifyEnabled: (u.questTimeNotifyEnabled as boolean | undefined) ?? true,
      rubyEnabled: (u.rubyEnabled as boolean | undefined) ?? true,
      studyPt: (u.studyPt as number) ?? 0,
      staminaPt: (u.staminaPt as number) ?? 0,
      lifePt: (u.lifePt as number) ?? 0,
      collectedPaths: (u.collectedPaths as string) ?? "[]",
      monsterSetId: (u.monsterSetId as string) ?? "dark",
      pendingMonsterSetId: (u.pendingMonsterSetId as string | null) ?? null,
      lastLoginDate: ((u.streak as { lastLoginDate: Date | null } | null)?.lastLoginDate ?? null)
        ? String((u.streak as { lastLoginDate: Date | null }).lastLoginDate)
        : null,
      ownedThemes: resolveOwnedThemes(
        ownedThemeRecords,
        (u.monsterSetId as string | null) ?? null,
      ),
    }));

    return NextResponse.json({
      code: isParent ? family?.code : null,
      members,
      // 子供が0人でも作成フォームで所持テーマを出せるよう、家族単位でも返す
      ownedThemes: resolveOwnedThemes(ownedThemeRecords, null),
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

  const familyId = user.familyId;
  try {
    if (familyId) {
      // Regenerate code（コード重複時はリトライ）
      const family = await withCodeRetry(() =>
        prisma.family.update({
          where: { id: familyId },
          data: { code: generateFamilyCode() },
        }),
      );
      rlog.info("Family code regenerated", { familyId });
      return NextResponse.json({ code: family.code });
    }

    // Create new family
    const family = await withCodeRetry(() =>
      prisma.family.create({
        data: {
          code: generateFamilyCode(),
          users: { connect: { id: user.id } },
        },
      }),
    );
    return NextResponse.json({ code: family.code });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log.error("Family code update failed", { route: "POST /api/family/code", error: message });
    return NextResponse.json({ error: "家族コードの発行に失敗しました" }, { status: 500 });
  }
}

const CODE_MAX_ATTEMPTS = 5;

/** 家族コードの unique 違反 (P2002) の場合のみ、コードを引き直して再試行する */
async function withCodeRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isUniqueViolation(e) || attempt >= CODE_MAX_ATTEMPTS) throw e;
    }
  }
}
