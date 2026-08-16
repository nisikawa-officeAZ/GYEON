// Server-side helper — returns the current authenticated Supabase user.
// Returns null if not authenticated. Does not throw.

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

const getCurrentUserCached = cache(async () => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
});

export async function getCurrentUser() {
  return getCurrentUserCached();
}
