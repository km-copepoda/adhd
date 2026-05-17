import { prisma } from "@/lib/prisma";
import type { AuthUser } from "@/lib/auth";

export type ResolveTargetChildResult =
  | { ok: true; child: NonNullable<Awaited<ReturnType<typeof prisma.user.findFirst>>> }
  | { ok: false; status: 400 | 403 | 404; error: string };

/**
 * 親セッションから子供モードで操作対象の子供を解決する。
 * - PARENT ロールでない / familyId が無い → 403
 * - childId 未指定 → 400
 * - 同一 family の CHILD が見つからない → 404
 */
export async function resolveTargetChild(
  parent: AuthUser,
  childId: string | null | undefined,
): Promise<ResolveTargetChildResult> {
  if (parent.role !== "PARENT" || !parent.familyId) {
    return { ok: false, status: 403, error: "権限がありません" };
  }
  if (!childId) {
    return { ok: false, status: 400, error: "childId が必要です" };
  }
  const child = await prisma.user.findFirst({
    where: { id: childId, familyId: parent.familyId, role: "CHILD" },
  });
  if (!child) {
    return { ok: false, status: 404, error: "対象の子供が見つかりません" };
  }
  return { ok: true, child };
}
