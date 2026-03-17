import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ user: data.user });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[login] unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
