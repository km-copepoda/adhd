import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { routeLogger } from "@/lib/logger";

export async function POST(request: Request) {
  const rlog = routeLogger("POST", "/api/auth/login");
  const { email, password } = await request.json();
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    rlog.warn("Login failed", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  rlog.info("Login success", { userId: data.user.id });
  return NextResponse.json({ user: data.user });
}
