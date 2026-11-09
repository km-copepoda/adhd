import { NextResponse, after } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { routeLogger } from "@/lib/logger";
import { isDeleteConfirmed } from "@/lib/accountDeletion.data";
import { deleteParentAccount } from "@/lib/accountDeletion";
import { runAccountCleanupJob } from "@/lib/accountCleanupJob";

export async function DELETE(request: Request) {
  const rlog = routeLogger("DELETE", "/api/account");
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "PARENT") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
  const confirm =
    body !== null && typeof body === "object" && !Array.isArray(body)
      ? (body as { confirm?: unknown }).confirm
      : undefined;
  if (!isDeleteConfirmed(confirm)) {
    return NextResponse.json({ error: "確認の入力が一致しません" }, { status: 400 });
  }

  try {
    const result = await deleteParentAccount(user.id, new Date());
    if (result.status === "not_found") {
      return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });
    }
    if (result.status === "subscription_active") {
      return NextResponse.json(
        { error: "有料プランを解約してから削除してください", code: "SUBSCRIPTION_ACTIVE" },
        { status: 409 },
      );
    }

    after(() => runAccountCleanupJob(result.jobId));
    rlog.warn("Account deleted", { userId: user.id, familyId: user.familyId, scope: result.scope });
    return NextResponse.json({ ok: true, scope: result.scope });
  } catch (e) {
    rlog.error("Account deletion failed", { userId: user.id, error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "アカウントの削除に失敗しました" }, { status: 500 });
  }
}
