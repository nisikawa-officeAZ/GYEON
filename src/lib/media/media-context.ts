// DealerOS — Media Runtime Context
//
// Sprint 10J: server-side context factory for all media operations.
// dealer_id is always resolved from getCurrentDealer() — never from client input.
//
// Usage (server-side only):
//   const ctx = await createMediaContext();
//   if (!ctx) return { error: "Not authenticated" };
//   const runtime = MediaRuntime.withContext(ctx);

import { randomUUID } from "crypto";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import type { MediaUploadPolicy } from "./media-validation";
import { CURRENT_UPLOAD_POLICY } from "./media-validation";

// ─── Context ──────────────────────────────────────────────────────────────────

/**
 * Runtime context for a media operation session.
 * Created once per request — never cached or reused across requests.
 */
export interface MediaContext {
  /** Always resolved from getCurrentDealer() — never from client input. */
  dealer_id:     string;
  /** Active upload policy for this context. Defaults to CURRENT_UPLOAD_POLICY. */
  upload_policy: MediaUploadPolicy;
  /** Per-request UUID for observability and future log correlation. */
  trace_id:      string;
  /** ISO 8601 timestamp when this context was created. */
  created_at:    string;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a MediaContext for the currently authenticated dealer.
 *
 * Returns null if:
 *   - User is not authenticated
 *   - No active dealer_members record exists for the user
 *
 * @param policy  Override the default upload policy. Omit to use CURRENT_UPLOAD_POLICY.
 */
export async function createMediaContext(
  policy?: MediaUploadPolicy,
): Promise<MediaContext | null> {
  const dealer = await getCurrentDealer();
  if (!dealer) return null;

  return {
    dealer_id:     dealer.dealer_id,
    upload_policy: policy ?? CURRENT_UPLOAD_POLICY,
    trace_id:      randomUUID(),
    created_at:    new Date().toISOString(),
  };
}
