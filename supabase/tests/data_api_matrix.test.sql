-- R12E DATA_API_MATRIX candidate
--
-- Self-contained pgTAP candidate. Embeds the FULL literal source inventory
-- (80 `.from(...)` literals + 20 `.rpc(...)` literals = 100 rows,
-- exactly as extracted from `src` via:
--   rg -o --no-filename "\.from\([\"\x27][A-Za-z0-9_]+[\"\x27]\)" src | sort -u   (80 lines)
--   rg -o --no-filename "\.rpc\([\"\x27][A-Za-z0-9_]+[\"\x27]"    src | sort -u   (20 lines)
-- ) and classifies every one exactly once. No UNCLASSIFIED rows are permitted.
--
-- GDA-2A-OCR-POSTAL-MASTER-R2 addendum (2026-09-01): 2 of the 20 `.rpc(...)` literals
-- (`jp_postal_master_lookup_forward`, `jp_postal_master_lookup_reverse`) were added by
-- `src/lib/geo/jp-postal-master-actions.ts`; the extraction command above was not re-run against a
-- live checkout in this phase (no shell/database access), so this line count is a manual, reasoned
-- update (18 pre-existing + 2 added), not a re-executed `rg` count.
--
-- IMPORTANT LIMITATION (read before trusting this file as "exposure proof"):
-- Every check below is a catalog/SQL-level check (information_schema, pg_proc,
-- pg_class, has_table_privilege/has_function_privilege, RLS flags). None of
-- this is real PostgREST or GoTrue/Auth request-scope evidence: it does not
-- issue an actual HTTP request through PostgREST with a real anon/authenticated
-- JWT, and it does not exercise RLS policies against real session claims.
-- Anon OpenAPI schema enumeration (`GET /` on PostgREST) is likewise NOT proof
-- of real exposure or non-exposure -- a table can appear in the anon OpenAPI
-- doc yet be fully denied by RLS, or be absent from the doc yet still reachable
-- via `.rpc()`. A later DISPOSABLE runtime gate test, exercised with real local
-- tokens (anon + authenticated + service-role) against a running PostgREST/Auth
-- stack, is required to actually prove that each CLIENT_EXPOSED path is
-- reachable and each SERVER_ONLY / FEATURE_GATED_ABSENT / NO_LONGER_ACTIVE path
-- is NOT reachable by the client roles this file assumes. This file only
-- verifies internal consistency of the classification matrix plus static
-- catalog/privilege posture.

BEGIN;

SELECT plan(20);

-- ===========================================================================
-- Embedded source inventory: kind, literal, classification, evidence
-- storage.from("documents") and storage.from("pdf") are STORAGE BUCKET
-- references, not database relations. They remain part of the 80 literal
-- `.from(...)` inventory but are excluded from public-relation checks.
-- ===========================================================================
CREATE TEMP TABLE src_inventory (
  kind            text NOT NULL CHECK (kind IN ('from','rpc')),
  literal         text NOT NULL,
  classification  text NOT NULL CHECK (classification IN
                    ('CLIENT_EXPOSED','SERVER_ONLY','FEATURE_GATED_ABSENT','NO_LONGER_ACTIVE')),
  evidence        text NOT NULL,
  is_storage_bucket boolean NOT NULL DEFAULT false,
  is_protected_excluded boolean NOT NULL DEFAULT false,
  required_table_privilege text NOT NULL DEFAULT 'SELECT'
    CHECK (required_table_privilege IN ('SELECT','INSERT','UPDATE','DELETE'))
);

INSERT INTO src_inventory (kind, literal, classification, evidence) VALUES
('from','activity_logs','SERVER_ONLY','src/lib/audit -- server-side audit trail writer'),
('from','admin_audit_logs','SERVER_ONLY','src/lib/admin -- admin console, service-role only'),
('from','admin_users','SERVER_ONLY','src/lib/admin -- admin console, service-role only'),
('from','audit_logs','SERVER_ONLY','src/lib/audit -- server-side audit trail writer'),
('from','billing_invoices','SERVER_ONLY','src/lib/billing -- server billing module'),
('from','completion_reports','CLIENT_EXPOSED','src/lib/completion-reports -- customer-facing report view'),
('from','customer_app_settings','CLIENT_EXPOSED','src/lib/customers -- browser client settings read'),
('from','customers','CLIENT_EXPOSED','src/lib/customers -- browser client CRUD'),
('from','dealer_ai_settings','FEATURE_GATED_ABSENT','src/lib/ai-settings -- future migration requires explicit CTO approval; UI returns MIGRATION_REQUIRED'),
('from','dealer_ai_usage_log','FEATURE_GATED_ABSENT','src/lib/ai -- future migration requires explicit CTO approval; usage tracking remains unavailable'),
('from','dealer_billing','SERVER_ONLY','src/lib/billing -- server billing module'),
('from','dealer_members','CLIENT_EXPOSED','src/lib/dealer -- browser client roster read'),
('from','dealer_ppf_coating_adjustments','SERVER_ONLY','src/lib/wizard-catalog -- server-side wiz_* rpc target table'),
('from','dealer_service_offerings','CLIENT_EXPOSED','src/lib/dealer-settings -- browser client settings UI'),
('from','dealer_settings','CLIENT_EXPOSED','src/lib/dealer-settings -- browser client settings UI'),
('from','dealer_staff','CLIENT_EXPOSED','src/lib/staff -- browser client roster UI'),
('from','dealer_stock_levels','SERVER_ONLY','src/lib/inventory -- server inventory sync'),
('from','dealer_subscriptions','SERVER_ONLY','src/lib/subscription -- server billing/subscription module'),
('from','dealer_wizard_catalog_lifecycle','FEATURE_GATED_ABSENT','src/lib/wizard-catalog -- lifecycle flow not yet wired to a live route'),
('from','dealers','CLIENT_EXPOSED','src/lib/dealer -- browser client tenant read'),
('from','document_files','SERVER_ONLY','src/lib/documents -- server document storage bookkeeping'),
('from','document_sequences','SERVER_ONLY','src/lib/numbering -- server numbering allocator'),
('from','documents','SERVER_ONLY','src/lib/documents, estimates, invoices, pdf -- storage.from("documents") server document workflows'),
('from','estimate_items','CLIENT_EXPOSED','src/lib/estimates -- browser client estimate editor'),
('from','estimate_shares','SERVER_ONLY','src/lib/estimates -- server actions and public-token resolver use createAdminClient'),
('from','estimates','CLIENT_EXPOSED','src/lib/estimates -- browser client estimate editor'),
('from','gyeon_ai_settings','SERVER_ONLY','src/lib/ai-settings/repository -- server settings repo'),
('from','gyeon_ai_usage_log','SERVER_ONLY','src/lib/ai -- server usage metering'),
('from','gyeon_dealer_provisioning','SERVER_ONLY','src/lib/gyeon -- server provisioning workflow'),
('from','gyeon_news','CLIENT_EXPOSED','src/lib/news -- browser client news feed'),
('from','gyeon_news_reads','CLIENT_EXPOSED','src/lib/news -- browser client read-state tracking'),
('from','gyeon_products','CLIENT_EXPOSED','src/lib/gyeon -- browser client catalog browse'),
('from','gyeon_resource_downloads','CLIENT_EXPOSED','src/lib/resources -- browser client download tracking'),
('from','gyeon_resources','CLIENT_EXPOSED','src/lib/resources -- browser client resource library'),
('from','gyeon_service_estimates','FEATURE_GATED_ABSENT','src/lib/gyeon -- estimate-sync feature not yet reachable from live UI'),
('from','inventory_receipts','SERVER_ONLY','src/lib/inventory -- server receiving workflow'),
('from','inventory_stocktaking_items','SERVER_ONLY','src/lib/admin/logistics -- admin-only stocktaking'),
('from','inventory_stocktaking_sessions','SERVER_ONLY','src/lib/admin/logistics -- admin-only stocktaking'),
('from','invoice_items','CLIENT_EXPOSED','src/lib/invoices -- browser client invoice editor'),
('from','invoices','CLIENT_EXPOSED','src/lib/invoices -- browser client invoice editor'),
('from','line_customers','SERVER_ONLY','src/lib/line -- LINE webhook/server integration'),
('from','line_link_tokens','SERVER_ONLY','src/lib/line -- LINE webhook/server integration'),
('from','line_message_logs','SERVER_ONLY','src/lib/line -- LINE webhook/server integration'),
('from','line_notification_queue','SERVER_ONLY','src/lib/line -- LINE webhook/server integration'),
('from','logistics_backorders','SERVER_ONLY','src/lib/admin/logistics -- admin-only logistics'),
('from','logistics_shipments','SERVER_ONLY','src/lib/admin/logistics -- admin-only logistics'),
('from','maintenance_reminders','CLIENT_EXPOSED','src/lib/maintenance -- browser client reminder list'),
('from','monthly_statement_adjustments','SERVER_ONLY','src/lib/monthly-statements -- server statement generation'),
('from','monthly_statement_lines','SERVER_ONLY','src/lib/monthly-statements -- server statement generation'),
('from','monthly_statement_receipts','SERVER_ONLY','src/lib/monthly-statements -- server statement generation'),
('from','monthly_statements','CLIENT_EXPOSED','src/lib/monthly-statements -- browser client statement view'),
('from','news_delivery_jobs','SERVER_ONLY','src/lib/news -- server delivery worker'),
('from','news_delivery_recipients','SERVER_ONLY','src/lib/news -- server delivery worker'),
('from','notifications','CLIENT_EXPOSED','src/lib/customer-engagement/engine -- browser client notification feed'),
('from','payment_allocations','SERVER_ONLY','src/lib/payments -- server allocation engine'),
('from','payments','CLIENT_EXPOSED','src/lib/payments -- browser client payment history'),
('from','pdf','SERVER_ONLY','src/lib/pdf -- storage.from("pdf") STORAGE BUCKET, not a DB relation; server-generated documents'),
('from','po_fulfillment_lines','SERVER_ONLY','src/lib/admin/logistics -- admin-only fulfillment'),
('from','point_cards','FEATURE_GATED_ABSENT','src/lib/customer-engagement/engine -- loyalty feature not yet live'),
('from','point_transactions','FEATURE_GATED_ABSENT','src/lib/customer-engagement/engine -- loyalty feature not yet live'),
('from','product_order_items','CLIENT_EXPOSED','src/lib/product-orders -- browser client order editor'),
('from','product_orders','CLIENT_EXPOSED','src/lib/product-orders -- browser client order editor'),
('from','reservations','CLIENT_EXPOSED','src/lib/reservations -- browser client booking UI'),
('from','staging_issues','NO_LONGER_ACTIVE','src/lib/staging-verification -- legacy staging harness, unreferenced entrypoint'),
('from','staging_verification_items','NO_LONGER_ACTIVE','src/lib/staging-verification -- legacy staging harness, unreferenced entrypoint'),
('from','staging_verification_runs','NO_LONGER_ACTIVE','src/lib/staging-verification -- legacy staging harness, unreferenced entrypoint'),
('from','stock_movements','SERVER_ONLY','src/lib/inventory -- server inventory ledger'),
('from','subscription_plans','CLIENT_EXPOSED','src/lib/subscription -- browser client plan picker'),
('from','uat_dealers','NO_LONGER_ACTIVE','src/lib/uat -- legacy UAT fixture module, unreferenced entrypoint'),
('from','uat_feedback','NO_LONGER_ACTIVE','src/lib/uat -- legacy UAT fixture module, unreferenced entrypoint'),
('from','uat_issues','NO_LONGER_ACTIVE','src/lib/uat -- legacy UAT fixture module, unreferenced entrypoint'),
('from','uat_sessions','NO_LONGER_ACTIVE','src/lib/uat -- legacy UAT fixture module, unreferenced entrypoint'),
('from','vehicle_registration_files','CLIENT_EXPOSED','src/lib/vehicle-registration -- browser client upload UI'),
('from','vehicle_registration_ocr_sessions','SERVER_ONLY','src/lib/ocr -- server OCR pipeline'),
('from','vehicles','CLIENT_EXPOSED','src/lib/vehicles -- browser client vehicle list'),
('from','warehouse_adjustments','SERVER_ONLY','src/lib/admin/logistics -- admin-only warehouse ops'),
('from','wizard_catalog_items','CLIENT_EXPOSED','src/lib/wizard-catalog -- browser client catalog wizard'),
('from','work_bays','CLIENT_EXPOSED','src/lib/work-bays -- browser client scheduling UI'),
('from','work_order_files','CLIENT_EXPOSED','src/lib/work-order-files -- browser client attachment UI'),
('from','work_orders','CLIENT_EXPOSED','src/lib/work-orders -- browser client work order UI');

INSERT INTO src_inventory (kind, literal, classification, evidence) VALUES
('rpc','attach_monthly_statement_pdf_rpc','SERVER_ONLY','src/lib/monthly-statements -- server-side statement finalization'),
('rpc','claim_gyeon_provisioning','SERVER_ONLY','src/lib/gyeon -- server provisioning workflow'),
('rpc','complete_gyeon_shop_profile','SERVER_ONLY','src/lib/gyeon -- server provisioning workflow'),
('rpc','consume_line_link_token','SERVER_ONLY','src/lib/line -- server-side LINE link exchange'),
('rpc','convert_payment_to_allocated_rpc','SERVER_ONLY','src/lib/payments -- server allocation engine'),
('rpc','create_monthly_statement_draft_rpc','SERVER_ONLY','src/lib/monthly-statements -- server-side statement generation'),
('rpc','get_next_document_number','SERVER_ONLY','src/lib/numbering -- server numbering allocator'),
('rpc','import_gyeon_provisioning','SERVER_ONLY','src/lib/gyeon -- server provisioning workflow'),
('rpc','issue_monthly_statement_rpc','SERVER_ONLY','src/lib/monthly-statements -- server-side statement finalization'),
-- GDA-2A-OCR-POSTAL-MASTER-R2 — added by src/lib/geo/jp-postal-master-actions.ts. The four
-- service-role-only import RPCs (jp_postal_import_begin/append/finalize/rollback) are deliberately
-- absent from this inventory: they are called only from scripts/postal-master/import-japan-post.ts
-- (outside `src`) via a non-literal function-name variable, so the literal-extraction command this
-- file documents (`rg ... src`) would not and does not capture them.
('rpc','jp_postal_master_lookup_forward','CLIENT_EXPOSED','src/lib/geo/jp-postal-master-actions.ts -- authenticated Server Action, postal-code-to-address lookup'),
('rpc','jp_postal_master_lookup_reverse','CLIENT_EXPOSED','src/lib/geo/jp-postal-master-actions.ts -- authenticated Server Action, address-to-postal-code lookup'),
('rpc','pg_version','SERVER_ONLY','src/lib/observability -- server diagnostics/health check'),
('rpc','record_payment_with_allocations_rpc','SERVER_ONLY','src/lib/payments -- server allocation engine'),
('rpc','save_estimate_from_wizard','SERVER_ONLY','src/components/estimates/wizard/save -- server gateway uses createAdminClient/service_role after server-resolved authority'),
('rpc','save_invoice_draft','CLIENT_EXPOSED','src/lib/invoices -- browser client draft autosave'),
('rpc','wiz_archive_catalog_item','CLIENT_EXPOSED','src/lib/wizard-catalog -- browser client catalog wizard action'),
('rpc','wiz_archive_ppf_coating_adjustment','CLIENT_EXPOSED','src/lib/wizard-catalog -- browser client catalog wizard action'),
('rpc','wiz_confirm_catalog_review','FEATURE_GATED_ABSENT','src/lib/wizard-catalog -- review-confirmation step not yet wired to a live route'),
('rpc','wiz_upsert_catalog_item','CLIENT_EXPOSED','src/lib/wizard-catalog -- browser client catalog wizard action'),
('rpc','wiz_upsert_ppf_coating_adjustment','CLIENT_EXPOSED','src/lib/wizard-catalog -- browser client catalog wizard action');

UPDATE src_inventory
   SET is_storage_bucket = true
 WHERE kind = 'from' AND literal IN ('documents', 'pdf');

UPDATE src_inventory
   SET is_protected_excluded = true
 WHERE (kind = 'from' AND literal IN ('gyeon_dealer_provisioning', 'line_link_tokens'))
    OR (kind = 'rpc' AND literal IN (
         'claim_gyeon_provisioning',
         'complete_gyeon_shop_profile',
         'consume_line_link_token',
         'import_gyeon_provisioning'
       ));

UPDATE src_inventory
   SET required_table_privilege = 'INSERT'
 WHERE kind = 'from'
   AND literal IN ('gyeon_resource_downloads', 'product_order_items');

-- ===========================================================================
-- Fixed exact source inventory (for uniqueness / no-missing / no-extra guards)
-- ===========================================================================
CREATE TEMP TABLE expected_from (literal text PRIMARY KEY);
INSERT INTO expected_from (literal) VALUES
('activity_logs'),('admin_audit_logs'),('admin_users'),('audit_logs'),('billing_invoices'),
('completion_reports'),('customer_app_settings'),('customers'),('dealer_ai_settings'),
('dealer_ai_usage_log'),('dealer_billing'),('dealer_members'),('dealer_ppf_coating_adjustments'),
('dealer_service_offerings'),('dealer_settings'),('dealer_staff'),('dealer_stock_levels'),
('dealer_subscriptions'),('dealer_wizard_catalog_lifecycle'),('dealers'),('document_files'),
('document_sequences'),('documents'),('estimate_items'),('estimate_shares'),('estimates'),
('gyeon_ai_settings'),('gyeon_ai_usage_log'),('gyeon_dealer_provisioning'),('gyeon_news'),
('gyeon_news_reads'),('gyeon_products'),('gyeon_resource_downloads'),('gyeon_resources'),
('gyeon_service_estimates'),('inventory_receipts'),('inventory_stocktaking_items'),
('inventory_stocktaking_sessions'),('invoice_items'),('invoices'),('line_customers'),
('line_link_tokens'),('line_message_logs'),('line_notification_queue'),('logistics_backorders'),
('logistics_shipments'),('maintenance_reminders'),('monthly_statement_adjustments'),
('monthly_statement_lines'),('monthly_statement_receipts'),('monthly_statements'),
('news_delivery_jobs'),('news_delivery_recipients'),('notifications'),('payment_allocations'),
('payments'),('pdf'),('po_fulfillment_lines'),('point_cards'),('point_transactions'),
('product_order_items'),('product_orders'),('reservations'),('staging_issues'),
('staging_verification_items'),('staging_verification_runs'),('stock_movements'),
('subscription_plans'),('uat_dealers'),('uat_feedback'),('uat_issues'),('uat_sessions'),
('vehicle_registration_files'),('vehicle_registration_ocr_sessions'),('vehicles'),
('warehouse_adjustments'),('wizard_catalog_items'),('work_bays'),('work_order_files'),
('work_orders');

CREATE TEMP TABLE expected_rpc (literal text PRIMARY KEY);
INSERT INTO expected_rpc (literal) VALUES
('attach_monthly_statement_pdf_rpc'),('claim_gyeon_provisioning'),('complete_gyeon_shop_profile'),
('consume_line_link_token'),('convert_payment_to_allocated_rpc'),('create_monthly_statement_draft_rpc'),
('get_next_document_number'),('import_gyeon_provisioning'),('issue_monthly_statement_rpc'),
  ('jp_postal_master_lookup_forward'),('jp_postal_master_lookup_reverse'),
  ('pg_version'),('record_payment_with_allocations_rpc'),('save_estimate_from_wizard'),
  ('save_invoice_draft'),('wiz_archive_catalog_item'),('wiz_archive_ppf_coating_adjustment'),
('wiz_confirm_catalog_review'),('wiz_upsert_catalog_item'),('wiz_upsert_ppf_coating_adjustment');

-- Fixed expected FEATURE_GATED_ABSENT literal sets, used ONLY to assert that
-- the classification itself is deterministic (this literal is, and stays,
-- labeled FEATURE_GATED_ABSENT) -- NOT to assert anything about whether the
-- underlying DB object exists. Application-layer gating does not imply the
-- schema object must be absent from the catalog (see Group C note below).
CREATE TEMP TABLE expected_feature_gated_from (literal text PRIMARY KEY);
INSERT INTO expected_feature_gated_from (literal) VALUES
  ('dealer_ai_settings'),('dealer_ai_usage_log'),
  ('dealer_wizard_catalog_lifecycle'),('gyeon_service_estimates'),
  ('point_cards'),('point_transactions');

CREATE TEMP TABLE expected_feature_gated_rpc (literal text PRIMARY KEY);
INSERT INTO expected_feature_gated_rpc (literal) VALUES
  ('wiz_confirm_catalog_review');

CREATE TEMP TABLE expected_protected_excluded (
  kind text NOT NULL CHECK (kind IN ('from','rpc')),
  literal text NOT NULL,
  PRIMARY KEY (kind, literal)
);
INSERT INTO expected_protected_excluded (kind, literal) VALUES
  ('from','gyeon_dealer_provisioning'),
  ('from','line_link_tokens'),
  ('rpc','claim_gyeon_provisioning'),
  ('rpc','complete_gyeon_shop_profile'),
  ('rpc','consume_line_link_token'),
  ('rpc','import_gyeon_provisioning');

-- ===========================================================================
-- Group A: inventory integrity (exact counts, totals, uniqueness)
-- ===========================================================================
SELECT is(
  (SELECT count(*) FROM src_inventory WHERE kind = 'from'),
  80::bigint,
  'exactly 80 .from(...) literals embedded'
);

SELECT is(
  (SELECT count(*) FROM src_inventory WHERE kind = 'rpc'),
  20::bigint,
  'exactly 20 .rpc(...) literals embedded (18 pre-existing + 2 added by src/lib/geo/jp-postal-master-actions.ts)'
);

SELECT is(
  (SELECT count(*) FROM src_inventory),
  100::bigint,
  'exactly 100 total classified rows (80 + 20)'
);

SELECT is(
  (SELECT count(DISTINCT literal) FROM src_inventory WHERE kind = 'from'),
  80::bigint,
  'all 80 .from(...) literals are unique (no duplicate classification rows)'
);

SELECT is(
  (SELECT count(DISTINCT literal) FROM src_inventory WHERE kind = 'rpc'),
  20::bigint,
  'all 20 .rpc(...) literals are unique (no duplicate classification rows)'
);

SELECT is(
  (SELECT count(*) FROM src_inventory
     WHERE classification IS NULL
        OR classification NOT IN ('CLIENT_EXPOSED','SERVER_ONLY','FEATURE_GATED_ABSENT','NO_LONGER_ACTIVE')),
  0::bigint,
  'zero UNCLASSIFIED rows: every literal has one of the four allowed classifications'
);

-- ===========================================================================
-- Group B: no missing / no extra vs the fixed embedded source inventory
-- ===========================================================================
SELECT is(
  (SELECT count(*) FROM expected_from e
     WHERE NOT EXISTS (SELECT 1 FROM src_inventory s WHERE s.kind = 'from' AND s.literal = e.literal)),
  0::bigint,
  'no missing .from(...) literal: every expected relation literal is classified'
);

SELECT is(
  (SELECT count(*) FROM src_inventory s
     WHERE s.kind = 'from'
       AND NOT EXISTS (SELECT 1 FROM expected_from e WHERE e.literal = s.literal)),
  0::bigint,
  'no extra .from(...) literal: no classified row lacks a matching source literal'
);

SELECT is(
  (SELECT count(*) FROM expected_rpc e
     WHERE NOT EXISTS (SELECT 1 FROM src_inventory s WHERE s.kind = 'rpc' AND s.literal = e.literal)),
  0::bigint,
  'no missing .rpc(...) literal: every expected rpc literal is classified'
);

SELECT is(
  (SELECT count(*) FROM src_inventory s
     WHERE s.kind = 'rpc'
       AND NOT EXISTS (SELECT 1 FROM expected_rpc e WHERE e.literal = s.literal)),
  0::bigint,
  'no extra .rpc(...) literal: no classified row lacks a matching source literal'
);

-- ===========================================================================
-- Group C: catalog presence/absence, appropriate to classification.
-- CLIENT_EXPOSED / SERVER_ONLY relations and functions are expected to be
-- live catalog objects today unless they belong to the exact protected-
-- excluded set. Those objects cannot be runtime-proved from this 100-migration
-- safe replay because the three protected migrations are metadata-only and
-- physically absent; the exception is bounded by exact set equality below.
--
-- FEATURE_GATED_ABSENT does NOT imply catalog absence: it means the caller
-- or feature is gated or absent at the application layer, not that the
-- underlying DB object must be missing (a table/function can be fully
-- provisioned in the schema while the UI/route that would call it is not
-- yet wired up or feature-flagged off). Asserting to_regclass(...) IS NULL
-- / "no matching pg_proc row" for these literals would invent an absence
-- claim the source evidence never supports, and would spuriously fail the
-- moment migrations land the object ahead of the feature. Instead, Group C
-- asserts the FEATURE_GATED_ABSENT *classification* is deterministic --
-- exactly the fixed expected set, no drift -- without making any claim
-- about catalog presence either way.
--
-- NO_LONGER_ACTIVE objects likewise make no presence claim either way (they
-- may be live orphaned tables/functions with no reachable caller, or
-- already dropped) -- only a diagnostic no-op assertion is registered for
-- that class, documented as such rather than silently skipped.
-- ===========================================================================
SELECT is(
  (
    (SELECT count(*) FROM src_inventory
       WHERE kind = 'from'
         AND is_storage_bucket = false
         AND is_protected_excluded = false
         AND classification IN ('CLIENT_EXPOSED','SERVER_ONLY')
         AND to_regclass('public.' || literal) IS NULL)
    +
    (SELECT count(*) FROM src_inventory s
       WHERE s.kind = 'from' AND s.is_protected_excluded
         AND NOT EXISTS (
           SELECT 1 FROM expected_protected_excluded e
            WHERE e.kind = s.kind AND e.literal = s.literal
         ))
    +
    (SELECT count(*) FROM expected_protected_excluded e
       WHERE e.kind = 'from'
         AND NOT EXISTS (
           SELECT 1 FROM src_inventory s
            WHERE s.kind = e.kind AND s.literal = e.literal
              AND s.is_protected_excluded
         ))
  ),
  0::bigint,
  'every non-protected CLIENT_EXPOSED/SERVER_ONLY table literal resolves to a live public relation; the protected-excluded table set is exact'
);

SELECT is(
  (
    (SELECT count(*) FROM src_inventory s
       WHERE s.kind = 'from' AND s.classification = 'FEATURE_GATED_ABSENT'
         AND NOT EXISTS (SELECT 1 FROM expected_feature_gated_from e WHERE e.literal = s.literal))
    +
    (SELECT count(*) FROM expected_feature_gated_from e
       WHERE NOT EXISTS (
         SELECT 1 FROM src_inventory s
         WHERE s.kind = 'from' AND s.classification = 'FEATURE_GATED_ABSENT' AND s.literal = e.literal
       ))
  ),
  0::bigint,
  'FEATURE_GATED_ABSENT table classification is deterministic and matches the fixed expected set exactly '
  || '(no catalog-absence claim is made: application-layer gating does not imply the DB relation is absent)'
);

SELECT pass(
  'NO_LONGER_ACTIVE table literals (staging_*, uat_*) make no catalog presence claim; '
  || 'dead-code status was determined by caller reachability, not schema presence'
);

SELECT is(
  (
    (SELECT count(*) FROM src_inventory
       WHERE kind = 'rpc'
         AND is_protected_excluded = false
         AND classification IN ('CLIENT_EXPOSED','SERVER_ONLY')
         AND NOT EXISTS (
           SELECT 1 FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'public' AND p.proname = src_inventory.literal
         ))
    +
    (SELECT count(*) FROM src_inventory s
       WHERE s.kind = 'rpc' AND s.is_protected_excluded
         AND NOT EXISTS (
           SELECT 1 FROM expected_protected_excluded e
            WHERE e.kind = s.kind AND e.literal = s.literal
         ))
    +
    (SELECT count(*) FROM expected_protected_excluded e
       WHERE e.kind = 'rpc'
         AND NOT EXISTS (
           SELECT 1 FROM src_inventory s
            WHERE s.kind = e.kind AND s.literal = e.literal
              AND s.is_protected_excluded
         ))
  ),
  0::bigint,
  'every non-protected CLIENT_EXPOSED/SERVER_ONLY rpc literal resolves to a live public function; the protected-excluded rpc set is exact'
);

SELECT is(
  (
    (SELECT count(*) FROM src_inventory s
       WHERE s.kind = 'rpc' AND s.classification = 'FEATURE_GATED_ABSENT'
         AND NOT EXISTS (SELECT 1 FROM expected_feature_gated_rpc e WHERE e.literal = s.literal))
    +
    (SELECT count(*) FROM expected_feature_gated_rpc e
       WHERE NOT EXISTS (
         SELECT 1 FROM src_inventory s
         WHERE s.kind = 'rpc' AND s.classification = 'FEATURE_GATED_ABSENT' AND s.literal = e.literal
       ))
  ),
  0::bigint,
  'FEATURE_GATED_ABSENT rpc classification is deterministic and matches the fixed expected set exactly '
  || '(no catalog-absence claim is made: application-layer gating does not imply the DB function is absent)'
);

-- ===========================================================================
-- Group D: least-privilege checks appropriate to classification.
-- CLIENT_EXPOSED objects must be reachable by the anon/authenticated roles at
-- the grant level (RLS still governs row-level outcomes -- not asserted here).
-- SERVER_ONLY / FEATURE_GATED_ABSENT / NO_LONGER_ACTIVE objects must NOT carry
-- a direct anon-role grant, since no browser code path is expected to reach
-- them; a leftover anon grant on such an object is a least-privilege defect.
--
-- The rpc checks below deliberately never pass a bare "schema.name" text
-- signature to has_function_privilege(): PostgreSQL resolves that form by
-- overload resolution, and it raises "function name is not unique" for any
-- literal with more than one pg_proc overload, turning a privilege check
-- into a spurious hard failure. Instead each check joins to pg_proc to
-- obtain the exact function identity (p.oid) per overload and calls the
-- oid-form has_function_privilege(role, p.oid, 'EXECUTE'), which is always
-- unambiguous regardless of how many overloads share the name.
-- ===========================================================================
SELECT is(
  (SELECT count(*) FROM src_inventory
     WHERE kind = 'from' AND is_storage_bucket = false
       AND classification = 'CLIENT_EXPOSED'
       AND to_regclass('public.' || literal) IS NOT NULL
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND NOT has_table_privilege('anon', 'public.' || literal, required_table_privilege)
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
       AND NOT has_table_privilege('authenticated', 'public.' || literal, required_table_privilege)),
  0::bigint,
  'every present CLIENT_EXPOSED table grants its exact source-required SELECT/INSERT privilege to anon or authenticated (RLS still applies)'
);

SELECT is(
  (SELECT count(*) FROM src_inventory
     WHERE kind = 'from' AND is_storage_bucket = false
       AND classification IN ('SERVER_ONLY','FEATURE_GATED_ABSENT','NO_LONGER_ACTIVE')
       AND to_regclass('public.' || literal) IS NOT NULL
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND has_table_privilege('anon', 'public.' || literal, 'SELECT')),
  0::bigint,
  'no SERVER_ONLY/FEATURE_GATED_ABSENT/NO_LONGER_ACTIVE table grants anon SELECT (least privilege)'
);

SELECT is(
  (SELECT count(*) FROM src_inventory s
     WHERE s.kind = 'rpc'
       AND s.classification IN ('SERVER_ONLY','FEATURE_GATED_ABSENT')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND EXISTS (
         SELECT 1 FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = s.literal
           AND has_function_privilege('anon', p.oid, 'EXECUTE')
       )),
  0::bigint,
  'no SERVER_ONLY/FEATURE_GATED_ABSENT rpc function overload (by exact pg_proc identity) grants anon EXECUTE (least privilege)'
);

SELECT is(
  (SELECT count(*) FROM src_inventory s
     WHERE s.kind = 'rpc'
       AND s.classification = 'CLIENT_EXPOSED'
       AND EXISTS (
         SELECT 1 FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = s.literal
       )
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
       AND EXISTS (
         SELECT 1 FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname = s.literal
           AND NOT has_function_privilege('anon', p.oid, 'EXECUTE')
           AND NOT has_function_privilege('authenticated', p.oid, 'EXECUTE')
       )),
  0::bigint,
  'every present CLIENT_EXPOSED rpc function overload (by exact pg_proc identity) grants EXECUTE to anon or authenticated'
);

-- ===========================================================================
-- Group E: explicit scope/limitation disclosure, recorded as an assertion so
-- it cannot be silently dropped from the suite.
-- ===========================================================================
SELECT pass(
  'SCOPE NOTE: all checks above are static SQL/catalog checks (information_schema, '
  || 'pg_proc, pg_class, has_table_privilege/has_function_privilege, RLS flags). '
  || 'They are NOT real PostgREST or Auth request-scope evidence -- no actual HTTP '
  || 'call was made through PostgREST with a real anon/authenticated JWT, and no RLS '
  || 'policy was evaluated against real session claims. Anon OpenAPI schema '
  || 'enumeration is likewise not exposure proof. A later DISPOSABLE runtime gate '
  || 'test, run with real local anon/authenticated/service-role tokens against a '
  || 'live PostgREST + Auth stack, is required to prove that intended paths are '
  || 'actually reachable (CLIENT_EXPOSED) or actually blocked (SERVER_ONLY, '
  || 'FEATURE_GATED_ABSENT, NO_LONGER_ACTIVE) before this matrix can be trusted '
  || 'as a security control rather than a documentation/consistency guard.'
);

SELECT * FROM finish();

ROLLBACK;
