import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { activateFamilyTheme } from "@/lib/monsterThemes";
import { MONSTER_THEMES } from "@/lib/monsterThemes/index";
import { routeLogger } from "@/lib/logger";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rlog = routeLogger("PATCH", "/api/family/members/[id]/monster-theme");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;

  // 同じファミリーの子供か確認
  const child = await prisma.user.findFirst({
    where: { id, familyId: user.familyId, role: "CHILD" },
  });
  if (!child) {
    return NextResponse.json({ error: "子供が見つかりません" }, { status: 403 });
  }

  const { themeId } = await request.json();
  if (typeof themeId !== "string" || !MONSTER_THEMES[themeId]) {
    return NextResponse.json({ error: "無効なテーマです" }, { status: 400 });
  }
  if (MONSTER_THEMES[themeId].isFree === false) {
    // 決済導線は未実装だが、開発者による手動DB挿入で「購入済み」として付与された
    // 家族は選択できる（Issue #90 / #111）。FamilyMonsterTheme の所持レコードで
    // 家族単位に判定する（childId ではなく親の familyId。兄弟間で所持を共有する）。
    const owned = await prisma.familyMonsterTheme.findUnique({
      where: { familyId_themeId: { familyId: user.familyId, themeId } },
    });
    if (!owned) {
      return NextResponse.json({ error: "このテーマはまだ購入されていません" }, { status: 400 });
    }
  }

  // 卵（進化前）または転生準備中は演出上の不整合が起きないため即時反映してよい
  const immediate = child.evolutionStage === 0 || child.rebirthPending === true;

  if (immediate) {
    await prisma.user.update({
      where: { id },
      data: { monsterSetId: themeId },
    });
    await activateFamilyTheme(user.familyId, themeId, "manual");
    rlog.info("Monster theme changed immediately", { childId: id, themeId });
    return NextResponse.json({ immediate: true, monsterSetId: themeId });
  }

  // 育成途中は見た目が急に変わらないよう、次の転生まで予約のみ
  await prisma.user.update({
    where: { id },
    data: { pendingMonsterSetId: themeId },
  });
  rlog.info("Monster theme reserved for next rebirth", { childId: id, themeId });
  return NextResponse.json({ immediate: false, pendingMonsterSetId: themeId });
}
