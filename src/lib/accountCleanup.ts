import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import type { ExternalCleanup } from "@/lib/accountDeletion.data";

// アカウント削除後の外部サービス削除。例外は投げず、失敗は対象 ID 付きでログに残し、未完了分を返す（outbox の再試行用）。

const BUCKET = "quest-photos";
const PAGE_SIZE = 1000;
const REMOVE_CHUNK = 1000;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

type AdminClient = ReturnType<typeof createAdminClient>;
type FailLogger = (kind: string, ctx: Record<string, unknown>, e: unknown) => void;

function isSafeFileName(name: unknown): name is string {
  return (
    typeof name === "string" &&
    name !== "" &&
    name !== "." &&
    name !== ".." &&
    !name.includes("/") &&
    !name.includes("\\") &&
    !CONTROL_CHARS.test(name)
  );
}

function isUserNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { status?: unknown; code?: unknown };
  return e.status === 404 || e.code === "user_not_found";
}

/** 削除に失敗した（未完了の）supabaseId を返す。存在しないユーザーは完了扱い */
async function deleteAuthUsers(admin: AdminClient, ids: string[], fail: FailLogger): Promise<string[]> {
  const remaining: string[] = [];
  for (const id of ids) {
    try {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error && !isUserNotFound(error)) {
        fail("auth_user", { id }, error);
        remaining.push(id);
      }
    } catch (e) {
      fail("auth_user", { id }, e);
      remaining.push(id);
    }
  }
  return remaining;
}

/** childId フォルダ直下のファイルをページングして列挙する。失敗時は ok=false（取得できた分は返す） */
async function listChildFiles(
  admin: AdminClient,
  childId: string,
  fail: FailLogger,
): Promise<{ paths: string[]; ok: boolean }> {
  const paths: string[] = [];
  let offset = 0;
  let ok = true;
  try {
    for (;;) {
      const { data, error } = await admin.storage.from(BUCKET).list(childId, { limit: PAGE_SIZE, offset });
      if (error || !data) {
        fail("storage_list", { id: childId, offset }, error ?? "no data");
        ok = false;
        break;
      }
      for (const f of data) {
        if (isSafeFileName(f.name)) paths.push(`${childId}/${f.name}`);
      }
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
  } catch (e) {
    fail("storage_list", { id: childId, offset }, e);
    ok = false;
  }
  return { paths, ok };
}

/** 削除に失敗した chunk のパスを返す */
async function removePhotos(admin: AdminClient, paths: string[], fail: FailLogger): Promise<string[]> {
  const remaining: string[] = [];
  for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
    const chunk = paths.slice(i, i + REMOVE_CHUNK);
    try {
      const { error } = await admin.storage.from(BUCKET).remove(chunk);
      if (error) {
        fail("storage_remove", { paths: chunk }, error);
        remaining.push(...chunk);
      }
    } catch (e) {
      fail("storage_remove", { paths: chunk }, e);
      remaining.push(...chunk);
    }
  }
  return remaining;
}

/** 外部削除を実行し、未完了分を返す（全成功なら空配列のみ）。例外は投げない */
export async function cleanupExternal(c: ExternalCleanup): Promise<ExternalCleanup> {
  const cleanupId = crypto.randomUUID();
  const familyId = c.familyId ?? undefined;
  const fail: FailLogger = (kind, ctx, e) => {
    log.error("account cleanup failed", {
      cleanupId,
      familyId,
      kind,
      ...ctx,
      error: e instanceof Error ? e.message : typeof e === "object" ? JSON.stringify(e) : String(e),
    });
  };

  const supabaseIds = [...new Set(c.supabaseIds)];
  const childIds = [...new Set(c.childIds)];
  const photoPaths = new Set(c.photoPaths);
  const unchanged: ExternalCleanup = { supabaseIds, childIds, photoPaths: [...photoPaths], familyId: c.familyId };
  if (supabaseIds.length === 0 && childIds.length === 0 && photoPaths.size === 0) return unchanged;

  try {
    let admin: AdminClient;
    try {
      admin = createAdminClient();
    } catch (e) {
      fail("admin_client", { supabaseIds, childIds, paths: [...photoPaths] }, e);
      return unchanged;
    }

    const remainingIds = await deleteAuthUsers(admin, supabaseIds, fail);
    const remainingChildIds: string[] = [];
    for (const childId of childIds) {
      const { paths, ok } = await listChildFiles(admin, childId, fail);
      if (!ok) remainingChildIds.push(childId);
      for (const p of paths) photoPaths.add(p);
    }
    const remainingPaths = await removePhotos(admin, [...photoPaths], fail);
    return { supabaseIds: remainingIds, childIds: remainingChildIds, photoPaths: remainingPaths, familyId: c.familyId };
  } catch (e) {
    fail("unexpected", {}, e);
    return unchanged;
  }
}
