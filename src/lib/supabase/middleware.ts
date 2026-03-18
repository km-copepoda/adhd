import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Public routes that don't require authentication
const PUBLIC_ROUTES = ["/", "/login", "/register", "/child/onboarding"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Skip auth check for API routes
  if (pathname.startsWith("/api/")) {
    return supabaseResponse;
  }

  // Determine role from Supabase user:
  // - Anonymous users (signInAnonymously) → CHILD
  // - Email/password users → PARENT
  const isChild = !!user && (user.is_anonymous === true || !user.email);
  const isParent = !!user && !isChild;

  // Rule: TOP page + logged in → redirect to role-specific home
  if (pathname === "/" && user) {
    const url = request.nextUrl.clone();
    url.pathname = isChild ? "/child/quests" : "/parent/tasks";
    return NextResponse.redirect(url);
  }

  // Rule: CHILD accessing /parent/* → redirect to child home
  if (pathname.startsWith("/parent") && isChild) {
    const url = request.nextUrl.clone();
    url.pathname = "/child/quests";
    return NextResponse.redirect(url);
  }

  // Rule: PARENT accessing /child/* → redirect to parent home
  if (pathname.startsWith("/child") && isParent) {
    const url = request.nextUrl.clone();
    url.pathname = "/parent/tasks";
    return NextResponse.redirect(url);
  }

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname === route + "/"
  );

  if (!user && !isPublicRoute) {
    // Not authenticated → redirect based on which section they tried to access
    const redirectTo = pathname.startsWith("/parent") ? "/login" : "/";
    const url = request.nextUrl.clone();
    url.pathname = redirectTo;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
