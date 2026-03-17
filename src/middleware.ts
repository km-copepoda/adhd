import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/session";

const PUBLIC_PATHS = ["/", "/login", "/register", "/child/onboarding"];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  // パブリックルートはセッション更新不要（不要なSupabase往復を避ける）
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname === p + "/")) {
    return NextResponse.next();
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
