// Server-side helper — returns the current authenticated Supabase user.
// Returns null if not authenticated. Does not throw.

import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}
