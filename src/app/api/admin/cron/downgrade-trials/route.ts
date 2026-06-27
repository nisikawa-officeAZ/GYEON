import { NextRequest, NextResponse } from "next/server";
import { checkAndDowngradeExpiredTrials } from "@/lib/admin/auto-downgrade";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint: POST /api/admin/cron/downgrade-trials
 *
 * Called by Vercel Cron or external scheduler (daily, e.g. 02:00 JST).
 * Requires Authorization: Bearer <CRON_SECRET> header.
 *
 * Vercel cron.json example:
 * {
 *   "crons": [{
 *     "path": "/api/admin/cron/downgrade-trials",
 *     "schedule": "0 17 * * *"   // 02:00 JST = 17:00 UTC
 *   }]
 * }
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth   = req.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await checkAndDowngradeExpiredTrials();

  return NextResponse.json({
    ok:         true,
    downgraded: result.downgraded,
    errors:     result.errors,
    ts:         new Date().toISOString(),
  });
}
