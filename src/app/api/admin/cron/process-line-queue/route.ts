import { NextRequest, NextResponse } from "next/server";
import { processLineNotificationQueueForCron } from "@/lib/line/process-line-queue-cron";

export const dynamic = "force-dynamic";

/**
 * Phase 4 Sprint 3 — Cron endpoint: POST /api/admin/cron/process-line-queue
 *
 * Sends DUE LINE notification queue items (maintenance reminders, etc.) via the LINE
 * push API. Credential-gated per dealer: items for dealers without valid LINE
 * credentials are skipped (never sent). Idempotent / retry-safe.
 *
 * Secret-protected: requires `Authorization: Bearer <CRON_SECRET>`. Fail-closed —
 * if CRON_SECRET is unset, all calls are rejected. Production scheduling (Vercel Cron
 * / external scheduler) is intentionally NOT configured here (out of Sprint 3 scope).
 *
 * Vercel cron.json example (NOT applied here):
 *   { "crons": [{ "path": "/api/admin/cron/process-line-queue", "schedule": "*\/5 * * * *" }] }
 */
export async function POST(req: NextRequest) {
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
    errors:    result.errors,
    ts:        new Date().toISOString(),
  });
}
