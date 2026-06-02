import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    reportDeadlineTime: (user as { reportDeadlineTime?: string | null }).reportDeadlineTime ?? null,
    minTasksForStreak: (user as { minTasksForStreak?: number }).minTasksForStreak ?? 1,
  });
}
