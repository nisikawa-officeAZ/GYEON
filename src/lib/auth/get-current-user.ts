// Server-side helper — returns the current authenticated Supabase user.
// Returns null if not authenticated. Does not throw.

import { createClient } from "@/lib/supabase/server";
import { cache } from "react";

async function resolveCurrentUser() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}

// React invalidates this cache for every server request. All Server Components
// in one render therefore share one fresh Auth lookup without carrying identity
// across users or requests.
export const getCurrentUser = cache(resolveCurrentUser);
