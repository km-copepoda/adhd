import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // /api/* は各 Route Handler の getCurrentUser() が認証する。ここで二重に認証すると
    // Auth への往復が増え、並列リクエストでトークン更新が衝突する（Issue #206）
    "/((?!api/|_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
