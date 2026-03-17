import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ supabaseUser: null, supabaseError: error?.message || "no user", dbUser: null });
    }

    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      select: { id: true, role: true, supabaseId: true, familyId: true },
    });

    return NextResponse.json({ supabaseUser: { id: user.id, email: user.email }, dbUser });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
