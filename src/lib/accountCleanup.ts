import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";
import type { ExternalCleanup } from "@/lib/accountDeletion.data";

// アカウント削除後の外部サービス削除（ベストエフォート）。例外は投げず、失敗は対象 ID 付きでログに残す。

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

async function deleteAuthUsers(admin: AdminClient, ids: string[], fail: FailLogger) {
  for (const id of ids) {
    try {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) fail("auth_user", { id }, error);
    } catch (e) {
      fail("auth_user", { id }, e);
    }
  }
}

/** childId フォルダ直下のファイルをページングして列挙する。失敗時は取得できた分を返してログに残す */
async function listChildFiles(admin: AdminClient, childId: string, fail: FailLogger): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  try {
    for (;;) {
      const { data, error } = await admin.storage.from(BUCKET).list(childId, { limit: PAGE_SIZE, offset });
      if (error || !data) {
        fail("storage_list", { id: childId, offset }, error ?? "no data");
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
  }
  return paths;
}

async function removePhotos(admin: AdminClient, paths: string[], fail: FailLogger) {
  for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
    const chunk = paths.slice(i, i + REMOVE_CHUNK);
    try {
      const { error } = await admin.storage.from(BUCKET).remove(chunk);
      if (error) fail("storage_remove", { paths: chunk }, error);
    } catch (e) {
      fail("storage_remove", { paths: chunk }, e);
    }
  }
}

export async function cleanupExternal(c: ExternalCleanup): Promise<void> {
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

  try {
    const supabaseIds = [...new Set(c.supabaseIds)];
    const childIds = [...new Set(c.childIds)];
    const photoPaths = new Set(c.photoPaths);
    if (supabaseIds.length === 0 && childIds.length === 0 && photoPaths.size === 0) return;

    let admin: AdminClient;
    try {
      admin = createAdminClient();
    } catch (e) {
      fail("admin_client", { supabaseIds, childIds, paths: [...photoPaths] }, e);
      return;
    }

    await deleteAuthUsers(admin, supabaseIds, fail);
    for (const childId of childIds) {
      for (const p of await listChildFiles(admin, childId, fail)) photoPaths.add(p);
    }
    await removePhotos(admin, [...photoPaths], fail);
  } catch (e) {
    fail("unexpected", {}, e);
  }
}
