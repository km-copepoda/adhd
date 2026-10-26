// サーバ専用: SUPABASE_SERVICE_ROLE_KEY（RLS を迂回する service role）を扱う。
// クライアントコンポーネントから import しないこと。src/lib/accountCleanup.ts からのみ import する。
// NEXT_PUBLIC_ 接頭辞を付けないことで、値がクライアントバンドルに入らないようにしている。
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
