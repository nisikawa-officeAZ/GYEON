-- BUSINESS_DOMAIN_MATRIX (Section 14.2 item 6 of
-- ENVIRONMENT_REMEDIATION_PLAN.md): tenant/Auth; customer/vehicle;
-- estimate/catalog/pricing; invoice/payment/monthly statements/PDF
-- pointers; work orders/completion/files; product orders/inventory/
-- logistics; reservations/reminders/queues; admin/audit/staging/UAT/AI
-- usage; and news/resources/branding/OCR.
--
-- Standalone pgTAP candidate. Reuses only the 82 accepted object
-- identities already ratified in supabase/tests/catalog_manifest.test.sql
-- (expected_relation, canonical row count = 82). No new relation identity
-- is fabricated here; this file classifies that same 82-row set into the
-- nine domain groups and declares one probe contract set per domain.
--
-- STATIC/UNEXECUTED CANDIDATE. Catalog-existence assertions below are
-- bounded, deterministic pg_catalog reads and may execute now against any
-- database. Every other probe (real Auth/session behavior, external
-- service or OCR provider calls, queue delivery/retry, separate-connection
-- concurrency, and live transactional/lifecycle/immutability behavior) is
-- explicitly labeled requires_runtime_gate = TRUE and is_executable_now =
-- FALSE: it documents a contract, not a proof. Execution against a live
-- disposable Supabase stack remains the separate disposable runtime gate
-- (Section 14.5). This file does not authorize a shared, linked, preview,
-- staging, or production connection, migration apply, commit, push,
-- Ready, merge, or deployment.

BEGIN;

SELECT plan(30);

-- ============================================================
-- domain_object_inventory: the 82 accepted relation identities from
-- catalog_manifest.test.sql expected_relation, classified into the nine
-- BUSINESS_DOMAIN_MATRIX domain groups.
-- ============================================================
create temp table domain_object_inventory (
  domain text,
  schema text,
  relation text
) on commit drop;

insert into domain_object_inventory (domain, schema, relation) values
  -- tenant_auth (7)
  ('tenant_auth', 'public', 'dealers'),
  ('tenant_auth', 'public', 'dealer_members'),
  ('tenant_auth', 'public', 'dealer_staff'),
  ('tenant_auth', 'public', 'dealer_settings'),
  ('tenant_auth', 'public', 'dealer_subscriptions'),
  ('tenant_auth', 'public', 'subscription_plans'),
  ('tenant_auth', 'public', 'dealer_billing'),
  -- customer_vehicle (6)
  ('customer_vehicle', 'public', 'customers'),
  ('customer_vehicle', 'public', 'customer_app_settings'),
  ('customer_vehicle', 'public', 'vehicles'),
  ('customer_vehicle', 'public', 'vehicle_registration_files'),
  ('customer_vehicle', 'public', 'point_cards'),
  ('customer_vehicle', 'public', 'point_transactions'),
  -- estimate_catalog_pricing (17)
  ('estimate_catalog_pricing', 'public', 'estimates'),
  ('estimate_catalog_pricing', 'public', 'estimate_items'),
  ('estimate_catalog_pricing', 'public', 'estimate_shares'),
  ('estimate_catalog_pricing', 'public', 'gyeon_service_estimates'),
  ('estimate_catalog_pricing', 'public', 'dealer_service_offerings'),
  ('estimate_catalog_pricing', 'public', 'dealer_wizard_catalog_lifecycle'),
  ('estimate_catalog_pricing', 'public', 'dealer_wizard_catalog_overrides'),
  ('estimate_catalog_pricing', 'public', 'dealer_ppf_coating_adjustments'),
  ('estimate_catalog_pricing', 'public', 'service_families'),
  ('estimate_catalog_pricing', 'public', 'wizard_catalog_item_categories'),
  ('estimate_catalog_pricing', 'public', 'wizard_catalog_item_ranks'),
  ('estimate_catalog_pricing', 'public', 'wizard_catalog_items'),
  ('estimate_catalog_pricing', 'public', 'wizard_kind_ownership_policy'),
  ('estimate_catalog_pricing', 'public', 'wizard_kind_policy'),
  ('estimate_catalog_pricing', 'public', 'wizard_product_modes'),
  ('estimate_catalog_pricing', 'public', 'wizard_rank_category_policy'),
  ('estimate_catalog_pricing', 'public', 'gyeon_products'),
  -- invoice_payment_statement_pdf (11)
  ('invoice_payment_statement_pdf', 'public', 'invoices'),
  ('invoice_payment_statement_pdf', 'public', 'invoice_items'),
  ('invoice_payment_statement_pdf', 'public', 'billing_invoices'),
  ('invoice_payment_statement_pdf', 'public', 'payments'),
  ('invoice_payment_statement_pdf', 'public', 'payment_allocations'),
  ('invoice_payment_statement_pdf', 'public', 'monthly_statements'),
  ('invoice_payment_statement_pdf', 'public', 'monthly_statement_lines'),
  ('invoice_payment_statement_pdf', 'public', 'monthly_statement_adjustments'),
  ('invoice_payment_statement_pdf', 'public', 'monthly_statement_receipts'),
  ('invoice_payment_statement_pdf', 'public', 'document_files'),
  ('invoice_payment_statement_pdf', 'public', 'document_sequences'),
  -- work_order_completion_files (4)
  ('work_order_completion_files', 'public', 'work_orders'),
  ('work_order_completion_files', 'public', 'work_bays'),
  ('work_order_completion_files', 'public', 'work_order_files'),
  ('work_order_completion_files', 'public', 'completion_reports'),
  -- product_order_inventory_logistics (11)
  ('product_order_inventory_logistics', 'public', 'product_orders'),
  ('product_order_inventory_logistics', 'public', 'product_order_items'),
  ('product_order_inventory_logistics', 'public', 'po_fulfillment_lines'),
  ('product_order_inventory_logistics', 'public', 'inventory_receipts'),
  ('product_order_inventory_logistics', 'public', 'inventory_stocktaking_sessions'),
  ('product_order_inventory_logistics', 'public', 'inventory_stocktaking_items'),
  ('product_order_inventory_logistics', 'public', 'stock_movements'),
  ('product_order_inventory_logistics', 'public', 'dealer_stock_levels'),
  ('product_order_inventory_logistics', 'public', 'logistics_backorders'),
  ('product_order_inventory_logistics', 'public', 'logistics_shipments'),
  ('product_order_inventory_logistics', 'public', 'warehouse_adjustments'),
  -- reservation_reminder_queue (6)
  ('reservation_reminder_queue', 'public', 'reservations'),
  ('reservation_reminder_queue', 'public', 'maintenance_reminders'),
  ('reservation_reminder_queue', 'public', 'notifications'),
  ('reservation_reminder_queue', 'public', 'line_customers'),
  ('reservation_reminder_queue', 'public', 'line_message_logs'),
  ('reservation_reminder_queue', 'public', 'line_notification_queue'),
  -- admin_audit_staging_uat_ai (13)
  ('admin_audit_staging_uat_ai', 'public', 'activity_logs'),
  ('admin_audit_staging_uat_ai', 'public', 'admin_audit_logs'),
  ('admin_audit_staging_uat_ai', 'public', 'admin_users'),
  ('admin_audit_staging_uat_ai', 'public', 'audit_logs'),
  ('admin_audit_staging_uat_ai', 'public', 'gyeon_ai_settings'),
  ('admin_audit_staging_uat_ai', 'public', 'gyeon_ai_usage_log'),
  ('admin_audit_staging_uat_ai', 'public', 'staging_issues'),
  ('admin_audit_staging_uat_ai', 'public', 'staging_verification_items'),
  ('admin_audit_staging_uat_ai', 'public', 'staging_verification_runs'),
  ('admin_audit_staging_uat_ai', 'public', 'uat_dealers'),
  ('admin_audit_staging_uat_ai', 'public', 'uat_feedback'),
  ('admin_audit_staging_uat_ai', 'public', 'uat_issues'),
  ('admin_audit_staging_uat_ai', 'public', 'uat_sessions'),
  -- news_resource_branding_ocr (7)
  ('news_resource_branding_ocr', 'public', 'gyeon_news'),
  ('news_resource_branding_ocr', 'public', 'gyeon_news_reads'),
  ('news_resource_branding_ocr', 'public', 'gyeon_resources'),
  ('news_resource_branding_ocr', 'public', 'gyeon_resource_downloads'),
  ('news_resource_branding_ocr', 'public', 'news_delivery_jobs'),
  ('news_resource_branding_ocr', 'public', 'news_delivery_recipients'),
  ('news_resource_branding_ocr', 'public', 'vehicle_registration_ocr_sessions');

-- ============================================================
-- domain_probe_contract: 4 probe rows per domain group (positive,
-- negative_fail_closed, lifecycle_or_immutability, cross_tenant_or_audit).
-- probe_basis 'catalog_existence' + is_executable_now = TRUE means the
-- probe is a bounded pg_catalog read this file can execute now. probe_basis
-- 'runtime_behavior' + requires_runtime_gate = TRUE means the probe
-- documents a contract that only the disposable runtime gate may claim
-- proven.
-- ============================================================
create temp table domain_probe_contract (
  domain text,
  probe_type text,
  probe_basis text,
  requires_runtime_gate boolean,
  is_executable_now boolean,
  gate_reason text,
  description text
) on commit drop;

insert into domain_probe_contract
  (domain, probe_type, probe_basis, requires_runtime_gate, is_executable_now, gate_reason, description)
values
  ('tenant_auth', 'positive', 'catalog_existence', FALSE, TRUE, NULL,
    'POSITIVE: dealers, dealer_members, dealer_staff, dealer_settings, dealer_subscriptions, subscription_plans and dealer_billing exist in public schema with RLS enabled per the accepted catalog manifest.'),
  ('tenant_auth', 'negative_fail_closed', 'runtime_behavior', TRUE, FALSE, 'requires local Auth session tokens and live RLS enforcement',
    'NEGATIVE_FAIL_CLOSED: an inactive dealer_members row, a foreign-dealer member, and an unauthenticated actor must be denied read/write on dealers, dealer_members, dealer_staff, dealer_settings, dealer_subscriptions and dealer_billing under real Auth session tokens.'),
  ('tenant_auth', 'lifecycle_or_immutability', 'runtime_behavior', TRUE, FALSE, 'requires live transactional execution against a disposable database',
    'LIFECYCLE: dealer_members activation/deactivation and dealer_subscriptions plan transitions must follow the accepted lifecycle state machine under live transactional execution.'),
  ('tenant_auth', 'cross_tenant_or_audit', 'runtime_behavior', TRUE, FALSE, 'requires two real tenant Auth sessions',
    'CROSS_TENANT: an authenticated member of tenant A must never read or mutate tenant B rows in dealers, dealer_members, dealer_staff, dealer_settings, dealer_subscriptions or dealer_billing under two real tenant sessions.'),

  ('customer_vehicle', 'positive', 'catalog_existence', FALSE, TRUE, NULL,
    'POSITIVE: customers, customer_app_settings, vehicles, vehicle_registration_files, point_cards and point_transactions exist in public schema with RLS enabled per the accepted catalog manifest.'),
  ('customer_vehicle', 'negative_fail_closed', 'runtime_behavior', TRUE, FALSE, 'requires local Auth session tokens and live RLS enforcement',
    'NEGATIVE_FAIL_CLOSED: an inactive or foreign-dealer member and an unauthenticated actor must be denied read/write on customers, vehicles, vehicle_registration_files, point_cards and point_transactions under real Auth session tokens.'),
  ('customer_vehicle', 'lifecycle_or_immutability', 'runtime_behavior', TRUE, FALSE, 'requires live transactional execution against a disposable database',
    'LIFECYCLE: point_cards balance mutation must only occur through point_transactions ledger entries, and vehicle_registration_files must remain immutable after OCR ingestion completes, proven under live transactional execution.'),
  ('customer_vehicle', 'cross_tenant_or_audit', 'runtime_behavior', TRUE, FALSE, 'requires two real tenant Auth sessions',
    'CROSS_TENANT: an authenticated member of tenant A must never read or mutate tenant B customers, vehicles, vehicle_registration_files, point_cards or point_transactions rows under two real tenant sessions.'),

  ('estimate_catalog_pricing', 'positive', 'catalog_existence', FALSE, TRUE, NULL,
    'POSITIVE: estimates, estimate_items, estimate_shares, gyeon_service_estimates, dealer_service_offerings, dealer_wizard_catalog_lifecycle, dealer_wizard_catalog_overrides, dealer_ppf_coating_adjustments, service_families, wizard_catalog_item_categories, wizard_catalog_item_ranks, wizard_catalog_items, wizard_kind_ownership_policy, wizard_kind_policy, wizard_product_modes, wizard_rank_category_policy and gyeon_products exist in public schema with RLS enabled per the accepted catalog manifest.'),
  ('estimate_catalog_pricing', 'negative_fail_closed', 'runtime_behavior', TRUE, FALSE, 'requires local Auth session tokens and live RLS enforcement',
    'NEGATIVE_FAIL_CLOSED: an inactive or foreign-dealer member and an unauthenticated actor must be denied write on estimates, estimate_items, wizard_catalog_items and dealer_wizard_catalog_overrides, and denied read on gyeon_products rows outside the shared global product master, under real Auth session tokens.'),
  ('estimate_catalog_pricing', 'lifecycle_or_immutability', 'runtime_behavior', TRUE, FALSE, 'requires live transactional execution against a disposable database',
    'LIFECYCLE: the estimate-wizard atomic-save path and the wizard_catalog_items archive/immutability guards must hold under live transactional execution.'),
  ('estimate_catalog_pricing', 'cross_tenant_or_audit', 'runtime_behavior', TRUE, FALSE, 'requires two real tenant Auth sessions',
    'CROSS_TENANT: an authenticated member of tenant A must never read or mutate tenant B estimates, estimate_items, dealer_service_offerings or dealer_wizard_catalog_overrides rows, while the shared gyeon_products global master remains readable to any active member, under two real tenant sessions.'),

  ('invoice_payment_statement_pdf', 'positive', 'catalog_existence', FALSE, TRUE, NULL,
    'POSITIVE: invoices, invoice_items, billing_invoices, payments, payment_allocations, monthly_statements, monthly_statement_lines, monthly_statement_adjustments, monthly_statement_receipts, document_files and document_sequences exist in public schema with RLS enabled per the accepted catalog manifest.'),
  ('invoice_payment_statement_pdf', 'negative_fail_closed', 'runtime_behavior', TRUE, FALSE, 'requires local Auth session tokens and live RLS enforcement',
    'NEGATIVE_FAIL_CLOSED: an inactive or foreign-dealer member and an unauthenticated actor must be denied read/write on invoices, payments, payment_allocations, monthly_statements and document_files under real Auth session tokens.'),
  ('invoice_payment_statement_pdf', 'lifecycle_or_immutability', 'runtime_behavior', TRUE, FALSE, 'requires live transactional execution against a disposable database',
    'LIFECYCLE: issued invoices and issued monthly_statements must reject further mutation, and document_sequences numbering must remain gap-free and idempotent, proven under live transactional execution.'),
  ('invoice_payment_statement_pdf', 'cross_tenant_or_audit', 'runtime_behavior', TRUE, FALSE, 'requires two real tenant Auth sessions plus audit_logs execution proof',
    'CROSS_TENANT_AUDIT: an authenticated member of tenant A must never read or mutate tenant B invoices, payments, monthly_statements or document_files rows, and every issue/payment/allocation action must produce a corresponding audit trail entry, under two real tenant sessions.'),

  ('work_order_completion_files', 'positive', 'catalog_existence', FALSE, TRUE, NULL,
    'POSITIVE: work_orders, work_bays, work_order_files and completion_reports exist in public schema with RLS enabled per the accepted catalog manifest.'),
  ('work_order_completion_files', 'negative_fail_closed', 'runtime_behavior', TRUE, FALSE, 'requires local Auth session tokens and live RLS enforcement',
    'NEGATIVE_FAIL_CLOSED: an inactive or foreign-dealer member and an unauthenticated actor must be denied read/write on work_orders, work_bays, work_order_files and completion_reports under real Auth session tokens.'),
  ('work_order_completion_files', 'lifecycle_or_immutability', 'runtime_behavior', TRUE, FALSE, 'requires live transactional execution against a disposable database',
    'LIFECYCLE: work_orders completion transitions and completion_reports PDF-pointer attachment must be immutable once finalized, proven under live transactional execution.'),
  ('work_order_completion_files', 'cross_tenant_or_audit', 'runtime_behavior', TRUE, FALSE, 'requires two real tenant Auth sessions',
    'CROSS_TENANT: an authenticated member of tenant A must never read or mutate tenant B work_orders, work_order_files or completion_reports rows under two real tenant sessions.'),

  ('product_order_inventory_logistics', 'positive', 'catalog_existence', FALSE, TRUE, NULL,
    'POSITIVE: product_orders, product_order_items, po_fulfillment_lines, inventory_receipts, inventory_stocktaking_sessions, inventory_stocktaking_items, stock_movements, dealer_stock_levels, logistics_backorders, logistics_shipments and warehouse_adjustments exist in public schema with RLS enabled per the accepted catalog manifest.'),
  ('product_order_inventory_logistics', 'negative_fail_closed', 'runtime_behavior', TRUE, FALSE, 'requires local Auth session tokens and live RLS enforcement',
    'NEGATIVE_FAIL_CLOSED: an inactive or foreign-dealer member and an unauthenticated actor must be denied read/write on product_orders, dealer_stock_levels, stock_movements and warehouse_adjustments under real Auth session tokens.'),
  ('product_order_inventory_logistics', 'lifecycle_or_immutability', 'runtime_behavior', TRUE, FALSE, 'requires live transactional execution and separate-connection concurrency proof',
    'LIFECYCLE: dealer_stock_levels must only change through stock_movements/inventory_receipts/warehouse_adjustments ledger entries, and po_fulfillment_lines/logistics_backorders/logistics_shipments quantity reconciliation must hold under live transactional execution and separate-connection concurrency proof.'),
  ('product_order_inventory_logistics', 'cross_tenant_or_audit', 'runtime_behavior', TRUE, FALSE, 'requires two real tenant Auth sessions',
    'CROSS_TENANT: an authenticated member of tenant A must never read or mutate tenant B product_orders, dealer_stock_levels or logistics_shipments rows under two real tenant sessions.'),

  ('reservation_reminder_queue', 'positive', 'catalog_existence', FALSE, TRUE, NULL,
    'POSITIVE: reservations, maintenance_reminders, notifications, line_customers, line_message_logs and line_notification_queue exist in public schema with RLS enabled per the accepted catalog manifest.'),
  ('reservation_reminder_queue', 'negative_fail_closed', 'runtime_behavior', TRUE, FALSE, 'requires local Auth session tokens and live RLS enforcement',
    'NEGATIVE_FAIL_CLOSED: an inactive or foreign-dealer member and an unauthenticated actor must be denied read/write on reservations, maintenance_reminders, line_customers and line_notification_queue under real Auth session tokens.'),
  ('reservation_reminder_queue', 'lifecycle_or_immutability', 'runtime_behavior', TRUE, FALSE, 'requires live transactional execution and real LINE queue delivery/retry proof',
    'LIFECYCLE: reservation status transitions and line_notification_queue delivery/retry state must follow the accepted queue state machine under live transactional execution and real LINE messaging integration.'),
  ('reservation_reminder_queue', 'cross_tenant_or_audit', 'runtime_behavior', TRUE, FALSE, 'requires two real tenant Auth sessions',
    'CROSS_TENANT: an authenticated member of tenant A must never read or mutate tenant B reservations, maintenance_reminders, line_customers or notifications rows under two real tenant sessions.'),

  ('admin_audit_staging_uat_ai', 'positive', 'catalog_existence', FALSE, TRUE, NULL,
    'POSITIVE: activity_logs, admin_audit_logs, admin_users, audit_logs, gyeon_ai_settings, gyeon_ai_usage_log, staging_issues, staging_verification_items, staging_verification_runs, uat_dealers, uat_feedback, uat_issues and uat_sessions exist in public schema with RLS enabled per the accepted catalog manifest.'),
  ('admin_audit_staging_uat_ai', 'negative_fail_closed', 'runtime_behavior', TRUE, FALSE, 'requires local Auth session tokens and live RLS enforcement',
    'NEGATIVE_FAIL_CLOSED: only admin_users/service_role actors may read or write admin_audit_logs, gyeon_ai_settings and gyeon_ai_usage_log; ordinary dealer members and unauthenticated actors must be denied under real Auth session tokens.'),
  ('admin_audit_staging_uat_ai', 'lifecycle_or_immutability', 'runtime_behavior', TRUE, FALSE, 'requires live transactional execution and real AI-provider call proof',
    'LIFECYCLE: staging_verification_runs/staging_issues and uat_sessions/uat_issues status transitions must hold, and gyeon_ai_usage_log must remain append-only, under live transactional execution and real AI-provider call proof.'),
  ('admin_audit_staging_uat_ai', 'cross_tenant_or_audit', 'runtime_behavior', TRUE, FALSE, 'requires two real tenant Auth sessions plus audit_logs execution proof',
    'CROSS_TENANT_AUDIT: activity_logs, admin_audit_logs and audit_logs must record every mutating action with correct tenant/actor attribution, and no tenant may read another tenant audit trail, under two real tenant sessions.'),

  ('news_resource_branding_ocr', 'positive', 'catalog_existence', FALSE, TRUE, NULL,
    'POSITIVE: gyeon_news, gyeon_news_reads, gyeon_resources, gyeon_resource_downloads, news_delivery_jobs, news_delivery_recipients and vehicle_registration_ocr_sessions exist in public schema with RLS enabled per the accepted catalog manifest.'),
  ('news_resource_branding_ocr', 'negative_fail_closed', 'runtime_behavior', TRUE, FALSE, 'requires local Auth session tokens and live RLS enforcement',
    'NEGATIVE_FAIL_CLOSED: an inactive or foreign-dealer member and an unauthenticated actor must be denied write on gyeon_news, gyeon_resources and vehicle_registration_ocr_sessions, and denied triggering news_delivery_jobs, under real Auth session tokens.'),
  ('news_resource_branding_ocr', 'lifecycle_or_immutability', 'runtime_behavior', TRUE, FALSE, 'requires live transactional execution and real OCR-provider call proof',
    'LIFECYCLE: gyeon_news_reads and gyeon_resource_downloads must remain append-only per actor, and vehicle_registration_ocr_sessions must transition through the accepted OCR state machine, under live transactional execution and real OCR-provider call proof.'),
  ('news_resource_branding_ocr', 'cross_tenant_or_audit', 'runtime_behavior', TRUE, FALSE, 'requires two real tenant Auth sessions',
    'CROSS_TENANT: dealer-branding public object reads must remain scoped to explicitly public assets only, and news_delivery_recipients must never cross-deliver to a foreign tenant, under two real tenant sessions.');

-- ============================================================
-- 1-9: per-domain OBJECT_COUNT (source-derived from the accepted
-- catalog_manifest.test.sql expected_relation 82-row set)
-- ============================================================
select is((select count(*)::int from domain_object_inventory where domain = 'tenant_auth'), 7,
  '1: tenant_auth OBJECT_COUNT is 7');
select is((select count(*)::int from domain_object_inventory where domain = 'customer_vehicle'), 6,
  '2: customer_vehicle OBJECT_COUNT is 6');
select is((select count(*)::int from domain_object_inventory where domain = 'estimate_catalog_pricing'), 17,
  '3: estimate_catalog_pricing OBJECT_COUNT is 17');
select is((select count(*)::int from domain_object_inventory where domain = 'invoice_payment_statement_pdf'), 11,
  '4: invoice_payment_statement_pdf OBJECT_COUNT is 11');
select is((select count(*)::int from domain_object_inventory where domain = 'work_order_completion_files'), 4,
  '5: work_order_completion_files OBJECT_COUNT is 4');
select is((select count(*)::int from domain_object_inventory where domain = 'product_order_inventory_logistics'), 11,
  '6: product_order_inventory_logistics OBJECT_COUNT is 11');
select is((select count(*)::int from domain_object_inventory where domain = 'reservation_reminder_queue'), 6,
  '7: reservation_reminder_queue OBJECT_COUNT is 6');
select is((select count(*)::int from domain_object_inventory where domain = 'admin_audit_staging_uat_ai'), 13,
  '8: admin_audit_staging_uat_ai OBJECT_COUNT is 13');
select is((select count(*)::int from domain_object_inventory where domain = 'news_resource_branding_ocr'), 7,
  '9: news_resource_branding_ocr OBJECT_COUNT is 7');

-- 10: TOTAL_OBJECT_COUNT matches the accepted 82-row expected_relation set
select is((select count(*)::int from domain_object_inventory), 82,
  '10: domain_object_inventory TOTAL_OBJECT_COUNT is 82 (matches catalog_manifest.test.sql expected_relation)');

-- 11: NO_DUPLICATE_OBJECT (schema, relation) identity is unique across the inventory
select is_empty(
  $$
    select schema, relation
    from domain_object_inventory
    group by schema, relation
    having count(*) > 1
  $$,
  '11: no duplicate (schema, relation) identity in domain_object_inventory'
);

-- 12: NO_UNCLASSIFIED_OBJECT every relation carries a non-null domain
select is_empty(
  $$
    select schema, relation from domain_object_inventory where domain is null or domain = ''
  $$,
  '12: no unclassified (null/empty domain) object in domain_object_inventory'
);

-- 13: DOMAIN_GROUP_COUNT exactly the nine accepted domain groups are populated
select is((select count(distinct domain)::int from domain_object_inventory), 9,
  '13: exactly 9 distinct domain groups present (zero missing domain group)');

-- 14: NO_EXTRA_DOMAIN_GROUP every domain value is a member of the fixed 9-key canon
select is_empty(
  $$
    select distinct domain
    from domain_object_inventory
    where domain not in (
      'tenant_auth', 'customer_vehicle', 'estimate_catalog_pricing',
      'invoice_payment_statement_pdf', 'work_order_completion_files',
      'product_order_inventory_logistics', 'reservation_reminder_queue',
      'admin_audit_staging_uat_ai', 'news_resource_branding_ocr'
    )
  $$,
  '14: no extra/unrecognized domain group key used in domain_object_inventory'
);

-- 15: CATALOG_EXISTENCE_LABELED live pg_catalog read (executes now): every
-- domain_object_inventory relation must exist as a relation in pg_catalog
-- when this file runs against an actual database.
select is(
  (
    select count(*)::int
    from domain_object_inventory doi
    where exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = doi.schema and c.relname = doi.relation
    )
  ),
  82,
  '15: CATALOG_EXISTENCE_LABELED all 82 domain_object_inventory relations exist in pg_catalog (executes now)'
);

-- ============================================================
-- 16-24: per-domain probe contract completeness (positive,
-- negative_fail_closed, lifecycle_or_immutability, cross_tenant_or_audit
-- all present and non-empty for each domain)
-- ============================================================
select is(
  (select count(*)::int from domain_probe_contract
    where domain = 'tenant_auth' and coalesce(length(description), 0) > 0),
  4, '16: tenant_auth has all 4 non-empty probe contracts');
select is(
  (select count(*)::int from domain_probe_contract
    where domain = 'customer_vehicle' and coalesce(length(description), 0) > 0),
  4, '17: customer_vehicle has all 4 non-empty probe contracts');
select is(
  (select count(*)::int from domain_probe_contract
    where domain = 'estimate_catalog_pricing' and coalesce(length(description), 0) > 0),
  4, '18: estimate_catalog_pricing has all 4 non-empty probe contracts');
select is(
  (select count(*)::int from domain_probe_contract
    where domain = 'invoice_payment_statement_pdf' and coalesce(length(description), 0) > 0),
  4, '19: invoice_payment_statement_pdf has all 4 non-empty probe contracts');
select is(
  (select count(*)::int from domain_probe_contract
    where domain = 'work_order_completion_files' and coalesce(length(description), 0) > 0),
  4, '20: work_order_completion_files has all 4 non-empty probe contracts');
select is(
  (select count(*)::int from domain_probe_contract
    where domain = 'product_order_inventory_logistics' and coalesce(length(description), 0) > 0),
  4, '21: product_order_inventory_logistics has all 4 non-empty probe contracts');
select is(
  (select count(*)::int from domain_probe_contract
    where domain = 'reservation_reminder_queue' and coalesce(length(description), 0) > 0),
  4, '22: reservation_reminder_queue has all 4 non-empty probe contracts');
select is(
  (select count(*)::int from domain_probe_contract
    where domain = 'admin_audit_staging_uat_ai' and coalesce(length(description), 0) > 0),
  4, '23: admin_audit_staging_uat_ai has all 4 non-empty probe contracts');
select is(
  (select count(*)::int from domain_probe_contract
    where domain = 'news_resource_branding_ocr' and coalesce(length(description), 0) > 0),
  4, '24: news_resource_branding_ocr has all 4 non-empty probe contracts');

-- 25: PROBE_CONTRACT_TOTAL_COUNT exactly 9 domains x 4 probe types
select is((select count(*)::int from domain_probe_contract), 36,
  '25: domain_probe_contract TOTAL_COUNT is 36 (9 domains x 4 probe types)');

-- 26: PROBE_CONTRACT_NO_EMPTY no probe contract row has an empty/null description
select is_empty(
  $$
    select domain, probe_type from domain_probe_contract
    where description is null or length(trim(description)) = 0
  $$,
  '26: no empty/null probe contract description'
);

-- 27: PROBE_CONTRACT_NO_WEAK no probe contract description is a weak/generic
-- placeholder (must be a substantive, object-name-bearing sentence)
select is_empty(
  $$
    select domain, probe_type from domain_probe_contract
    where length(trim(description)) <= 40
  $$,
  '27: no weakened (too-short/generic) probe contract description'
);

-- 28: PROBE_CONTRACT_LABEL_HONESTY every probe requiring the later runtime
-- gate is not claimed executable now, and carries a gate_reason
select is_empty(
  $$
    select domain, probe_type from domain_probe_contract
    where requires_runtime_gate = TRUE
      and (is_executable_now = TRUE or gate_reason is null or length(trim(gate_reason)) = 0)
  $$,
  '28: every runtime-gated probe is honestly labeled not-yet-executable with a gate_reason'
);

-- 29: PROBE_CONTRACT_CATALOG_ONLY_EXECUTABLE probes claimed executable now
-- are catalog-existence checks only, never Auth/external/OCR/queue/
-- concurrency/transactional behavior
select is_empty(
  $$
    select domain, probe_type from domain_probe_contract
    where is_executable_now = TRUE
      and (probe_basis <> 'catalog_existence' or requires_runtime_gate = TRUE)
  $$,
  '29: only catalog_existence probes are claimed executable now'
);

-- 30: PROBE_TYPE_SET_PER_DOMAIN every domain declares exactly the four
-- canonical probe types, each exactly once
select is_empty(
  $$
    select domain, probe_type
    from domain_probe_contract
    group by domain, probe_type
    having count(*) <> 1
    union
    select domain, probe_type
    from domain_probe_contract
    where probe_type not in (
      'positive', 'negative_fail_closed', 'lifecycle_or_immutability', 'cross_tenant_or_audit'
    )
  $$,
  '30: every domain declares exactly the 4 canonical probe types, each exactly once'
);

SELECT * FROM finish();

ROLLBACK;
