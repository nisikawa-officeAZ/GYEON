// PHASE61: Migration status types and static expected migration list.
// NOT a "use server" file — safe to import from both server and client contexts.

// ─── Types ────────────────────────────────────────────────────────────────────

export type MigrationAppliedStatus = "applied" | "missing" | "unknown";

export interface MigrationInfo {
  number:              number;
  filename:            string;
  purpose:             string;
  probe:               MigrationProbe;
  schemaLikelyApplied: boolean;
  status:              MigrationAppliedStatus;
  note:                string;
}

export interface MigrationStatusReport {
  overall:    "ready" | "warning" | "blocked";
  migrations: MigrationInfo[];
  checkedAt:  string;
}

export type MigrationProbe =
  | { type: "table";  table: string }
  | { type: "column"; table: string; column: string }
  | { type: "seed";   table: string; column: string; value: string };

// ─── Canonical migration list ─────────────────────────────────────────────────
// Derived from docs/MIGRATION_APPLICATION_ORDER.md and actual repo files.
// Probes are lightweight schema checks — not authoritative, but useful for
// surfacing likely unapplied migrations during staging verification.

export function getExpectedMigrationList(): Omit<MigrationInfo, "schemaLikelyApplied" | "status" | "note">[] {
  return [
    {
      number:  1,
      filename: "001_create_core_tables.sql",
      purpose:  "Core tables: auth.users extension, base schema",
      probe:    { type: "table", table: "dealers" },
    },
    {
      number:  2,
      filename: "002_enable_rls.sql",
      purpose:  "Enable Row Level Security on all tables",
      probe:    { type: "table", table: "dealers" },
    },
    {
      number:  3,
      filename: "003_create_dealers_and_members.sql",
      purpose:  "dealers + dealer_members tables, RLS",
      probe:    { type: "table", table: "dealer_members" },
    },
    {
      number:  4,
      filename: "004_enable_saas_rls.sql",
      purpose:  "SaaS RLS policies for multi-tenant isolation",
      probe:    { type: "table", table: "dealer_members" },
    },
    {
      number:  5,
      filename: "035_update_customers_schema.sql",
      purpose:  "Customers table schema update",
      probe:    { type: "table", table: "customers" },
    },
    {
      number:  6,
      filename: "036_update_vehicles_schema.sql",
      purpose:  "Vehicles table schema update",
      probe:    { type: "table", table: "vehicles" },
    },
    {
      number:  7,
      filename: "037_rebuild_estimate_core.sql",
      purpose:  "Estimates + estimate_items tables",
      probe:    { type: "table", table: "estimates" },
    },
    {
      number:  8,
      filename: "038_create_work_orders.sql",
      purpose:  "Work orders table",
      probe:    { type: "table", table: "work_orders" },
    },
    {
      number:  9,
      filename: "039_create_work_order_files.sql",
      purpose:  "Work order file attachments",
      probe:    { type: "table", table: "work_order_files" },
    },
    {
      number: 10,
      filename: "040_create_completion_reports.sql",
      purpose:  "Completion reports table",
      probe:    { type: "table", table: "completion_reports" },
    },
    {
      number: 11,
      filename: "041_create_invoices.sql",
      purpose:  "Invoices table",
      probe:    { type: "table", table: "invoices" },
    },
    {
      number: 12,
      filename: "042_create_payments.sql",
      purpose:  "Payments table",
      probe:    { type: "table", table: "payments" },
    },
    {
      number: 13,
      filename: "043_create_line_customers.sql",
      purpose:  "LINE customers + dealer_settings tables",
      probe:    { type: "table", table: "line_customers" },
    },
    {
      number: 14,
      filename: "044_create_line_message_logs.sql",
      purpose:  "LINE message logs table",
      probe:    { type: "table", table: "line_message_logs" },
    },
    {
      number: 15,
      filename: "045_create_maintenance_reminders.sql",
      purpose:  "Maintenance reminders table",
      probe:    { type: "table", table: "maintenance_reminders" },
    },
    {
      number: 16,
      filename: "046_create_document_sequences.sql",
      purpose:  "Document auto-numbering sequences",
      probe:    { type: "table", table: "document_sequences" },
    },
    {
      number: 17,
      filename: "047_create_gyeon_products.sql",
      purpose:  "GYEON product catalog table",
      probe:    { type: "table", table: "gyeon_products" },
    },
    {
      number: 18,
      filename: "048_create_product_orders.sql",
      purpose:  "Product orders table",
      probe:    { type: "table", table: "product_orders" },
    },
    {
      number: 19,
      filename: "049_add_plan_to_dealers.sql",
      purpose:  "Add plan/subscription_status/started_at/expired_at to dealers",
      probe:    { type: "column", table: "dealers", column: "plan" },
    },
    {
      number: 20,
      filename: "050_create_staff_roles.sql",
      purpose:  "dealer_staff table, staff roles, RLS",
      probe:    { type: "table", table: "dealer_staff" },
    },
    {
      number: 21,
      filename: "051_create_admin_tables.sql",
      purpose:  "admin_users + admin_audit_logs tables",
      probe:    { type: "table", table: "admin_users" },
    },
    {
      number: 22,
      filename: "052_create_reservations.sql",
      purpose:  "Reservations table + calendar_provider columns",
      probe:    { type: "table", table: "reservations" },
    },
    {
      number: 23,
      filename: "053_create_document_files.sql",
      purpose:  "document_files table for PDF storage",
      probe:    { type: "table", table: "document_files" },
    },
    {
      number: 24,
      filename: "054_notification_activity_timeline.sql",
      purpose:  "activity_logs + notifications tables",
      probe:    { type: "table", table: "activity_logs" },
    },
    {
      number: 25,
      filename: "055_audit_logs.sql",
      purpose:  "audit_logs immutable table + RLS",
      probe:    { type: "table", table: "audit_logs" },
    },
    {
      number: 26,
      filename: "058_subscription_license_management.sql",
      purpose:  "subscription_plans + dealer_subscriptions tables; seeds 3 plans",
      probe:    { type: "seed", table: "subscription_plans", column: "code", value: "pro" },
    },
    {
      number: 27,
      filename: "059_dealer_onboarding.sql",
      purpose:  "Onboarding + document settings columns on dealer_settings",
      probe:    { type: "column", table: "dealer_settings", column: "onboarding_completed" },
    },
  ];
}
