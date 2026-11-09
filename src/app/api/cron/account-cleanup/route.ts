import { NextResponse } from "next/server";
import { runPendingAccountCleanupJobs } from "@/lib/accountCleanupJob";
import { routeLogger } from "@/lib/logger";

export async function GET(request: Request) {
  const rlog = routeLogger("GET", "/api/cron/account-cleanup");
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    rlog.warn("Unauthorized cron request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const processed = await runPendingAccountCleanupJobs();
  rlog.info("Account cleanup cron finished", { processed });
  return NextResponse.json({ ok: true, processed });
}
