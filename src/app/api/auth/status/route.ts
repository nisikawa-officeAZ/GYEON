// Pre-flight auth check for OCR upload — never caches, never exposes secrets.
// Returns only boolean flags safe for the client to read.

import { NextResponse } from "next/server";
import { getCurrentUser }   from "@/lib/auth/get-current-user";
import { getCurrentDealer } from "@/lib/auth/get-current-dealer";
import { isGyeonManagedKeyConfigured } from "@/lib/ai/gyeon-managed-key";

export const dynamic = "force-dynamic";

export interface AuthStatusResponse {
  authenticated: boolean;
  hasDealer:     boolean;
  hasOcrKey:     boolean;
}

export async function GET(): Promise<NextResponse<AuthStatusResponse>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ authenticated: false, hasDealer: false, hasOcrKey: false });
    }
    const dealer   = await getCurrentDealer();
    // OCR availability = GYEON-managed key resolvable (AI Center DB key first,
    // OPENAI_API_KEY env only as dev fallback). No direct env-only check.
    const hasOcrKey = await isGyeonManagedKeyConfigured();
    return NextResponse.json({ authenticated: true, hasDealer: !!dealer, hasOcrKey });
  } catch {
    // Return safe fallback — component will still allow the upload attempt
    return NextResponse.json({ authenticated: false, hasDealer: false, hasOcrKey: false });
  }
}
