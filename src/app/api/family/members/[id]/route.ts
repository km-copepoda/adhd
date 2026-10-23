import { NextResponse, after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { deleteChildAccount } from "@/lib/accountDeletion";
import { cleanupExternal } from "@/lib/accountCleanup";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rlog = routeLogger("DELETE", "/api/family/members/[id]");
  const user = await getCurrentUser();
  if (!user || user.role !== "PARENT" || !user.familyId) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const { id } = await params;

  // 同じファミリーの子供かの確認と削除は tx 内で一体に行う
  let result;
  try {
    result = await deleteChildAccount({ childId: id, familyId: user.familyId });
  } catch (e) {
    rlog.error("Family member deletion failed", {
      deletedChildId: id,
      familyId: user.familyId,
      userId: user.id,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
  if (!result) {
    return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
  }

  after(() => cleanupExternal(result.cleanup));
  rlog.warn("Family member deleted", { deletedChildId: id, familyId: user.familyId, userId: user.id });
  return NextResponse.json({ ok: true });
}
