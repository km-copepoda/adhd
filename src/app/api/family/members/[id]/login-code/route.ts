import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { issueLoginCode } from "@/lib/childLoginCodeService";

// POST: 親が子どものワンタイムのログインコードを発行する（再発行すると前のコードは無効）
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rlog = routeLogger("POST", "/api/family/members/[id]/login-code");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;
  try {
    // 同じ家族の子どもだけが対象
    const child = await prisma.user.findFirst({
      where: { id, familyId: user.familyId, role: "CHILD" },
    });
    if (!child) {
      return NextResponse.json({ error: "子供が見つかりません" }, { status: 404 });
    }

    const { code, expiresAt } = await issueLoginCode(child.id);
    rlog.info("Child login code issued", { childId: child.id });
    return NextResponse.json({ code, expiresAt: expiresAt.toISOString() });
  } catch (e) {
    rlog.error("Failed to issue child login code", { error: String(e) });
    return NextResponse.json({ error: "コードの発行に失敗しました" }, { status: 500 });
  }
}
