import { NextRequest, NextResponse } from "next/server";
import { processLineNotificationQueueForCron } from "@/lib/line/process-line-queue-cron";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint: /api/admin/cron/process-line-queue
 *
 * Recovers stalled items (reaper + retry, Phase 5 Sprint 1) then sends DUE LINE
 * notification queue items via the LINE push API. Credential-gated per dealer.
 *
 * Secret-protected: requires `Authorization: Bearer <CRON_SECRET>`. Fail-closed —
 * if CRON_SECRET is unset, all calls are rejected. Scheduled by Vercel Cron (GET, which
 * Vercel sends with the Bearer secret); external schedulers / manual triggers may POST.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth   = req.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processLineNotificationQueueForCron();

  return NextResponse.json({
    ok:        true,
    processed: result.processed,
    sent:      result.sent,
    failed:    result.failed,
    skipped:   result.skipped,
    reaped:    result.reaped,
    requeued:  result.requeued,
    errors:    result.errors,
    ts:        new Date().toISOString(),
  });
}

export async function GET(req: NextRequest)  { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
