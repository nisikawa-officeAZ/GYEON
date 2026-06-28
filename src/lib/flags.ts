// Feature flags.
//
// BRANDING_SCHEMA_READY gates the dealer_settings branding/bank columns added by
// migrations 081 + 084. These columns exist in the production database but are
// NOT yet exposed by the production PostgREST schema cache (open Supabase support
// ticket — stale API↔DB binding after a preview-branch deletion). Until that is
// resolved, writing/reading those columns via the REST API fails with PGRST204 /
// 42703, which would otherwise break the whole dealer_settings upsert.
//
// While this is false:
//   - Store settings save (CompanySettingsForm) omits the bank columns, so the
//     pre-existing fields (name, contact, tax, etc.) still save normally.
//   - Branding save (BrandingSettingsForm) and the bank section are disabled in
//     the UI with a "temporarily unavailable" notice. No branding code is removed.
//
// Flip to true the moment Supabase confirms REST exposes the columns
// (re-probe `select=stamp_kind` returns 200). Can also be overridden at runtime
// via NEXT_PUBLIC_BRANDING_SCHEMA_READY=true without a code change.
export const BRANDING_SCHEMA_READY =
  process.env.NEXT_PUBLIC_BRANDING_SCHEMA_READY === "true" ? true : false;
