import { NextRequest, NextResponse } from "next/server";
import { processDueMaintenanceRemindersForCron } from "@/lib/maintenance/process-due-maintenance-cron";

export const dynamic = "force-dynamic";

/**
 * Phase 4 Sprint 2 — Cron endpoint: POST /api/admin/cron/process-due-maintenance
 *
 * Converts DUE maintenance reminders into queue-READY line_notification_queue records.
 * It does NOT send LINE messages (sending is a later sprint).
 *
 * Secret-protected: requires `Authorization: Bearer <CRON_SECRET>`. Fail-closed —
 * if CRON_SECRET is unset, all calls are rejected. Production scheduling (Vercel Cron
 * / external scheduler) is intentionally NOT configured here (out of Sprint 2 scope).
 *
 * Vercel cron.json example (NOT applied here):
 *   { "crons": [{ "path": "/api/admin/cron/process-due-maintenance", "schedule": "0 * * * *" }] }
 */
// Vercel Cron invokes via GET (with Authorization: Bearer $CRON_SECRET); external
// schedulers / manual triggers may use POST. Both share the same secret-guarded handler.
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth   = req.headers.get("authorization");

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processDueMaintenanceRemindersForCron();

  return NextResponse.json({
    ok:        true,
    processed: result.processed,
    queued:    result.queued,
    failed:    result.failed,
    skipped:   result.skipped,
    errors:    result.errors,
    ts:        new Date().toISOString(),
  });
}

export async function GET(req: NextRequest)  { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
