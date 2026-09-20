-- FUNCTION_TRIGGER_MATRIX (Section 14.2.5 / Section 14.5.9 of
-- ENVIRONMENT_REMEDIATION_PLAN.md): every final callable and trigger
-- definition, least-privilege EXECUTE grants, accepted caller/owner
-- behavior, transaction rollback/audit labeling, and pinned search_path
-- for every accepted security-definer function. No unjustified PUBLIC
-- EXECUTE is allowed.
--
-- Standalone pgTAP candidate. Reuses only the accepted exact row sets
-- already ratified in supabase/tests/catalog_manifest.test.sql:
-- expected_function (64 rows), expected_trigger (59 rows), and
-- expected_function_execute_acl (24 rows). No new expected data is
-- fabricated here.
--
-- normalized_definition is excluded from the function/trigger
-- NO_MISSING/NO_UNEXPECTED comparisons for the same reason recorded
-- against catalog_manifest.test.sql assertions 62/63/68/69
-- (R12C_FT_BLOCKER.md): the accepted source ledger's normalized_definition
-- is a header-only / mixed-qualification text that pg_get_functiondef and
-- pg_get_triggerdef cannot be compared against without fabricating
-- equality or a false failure. All other fields remain exact.
--
-- Execution against a live database is the disposable runtime gate's
-- responsibility (Section 14.5). Assertions labeled LABELED below
-- document a contract that this static file cannot itself execute proof
-- for beyond the bounded, deterministic checks shown.

BEGIN;

SELECT plan(19);

-- ============================================================
-- expected_function (64 rows) -- source: catalog_manifest.test.sql
-- ============================================================
create temp table expected_function (
  schema text,
  name text,
  identity_argument_types text,
  result_type text,
  language text,
  security_definer boolean,
  provolatile text,
  proparallel text,
  leakproof boolean,
  strict boolean,
  proconfig_in_order text[],
  normalized_definition text
) on commit drop;

insert into expected_function
  (schema, name, identity_argument_types, result_type, language,
   security_definer, provolatile, proparallel, leakproof, strict,
   proconfig_in_order, normalized_definition)
values
  ('public', 'attach_monthly_statement_pdf_rpc', 'uuid, uuid, uuid', 'public.monthly_statements', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.attach_monthly_statement_pdf_rpc( p_dealer_id uuid, p_statement_id uuid, p_document_file_id uuid ) RETURNS public.monthly_statements LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'b3_recalc_invoice_payment', 'uuid', 'void', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.b3_recalc_invoice_payment(p_invoice_id uuid) RETURNS void LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'bump_invoice_content_version', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.bump_invoice_content_version() RETURNS trigger LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'convert_payment_to_allocated_rpc', 'uuid, uuid, uuid, jsonb', 'public.payments', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.convert_payment_to_allocated_rpc( p_dealer_id uuid, p_actor uuid, p_payment_id uuid, p_allocations jsonb ) RETURNS public.payments LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'create_monthly_statement_draft_rpc', 'uuid, uuid, uuid, date', 'public.monthly_statements', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.create_monthly_statement_draft_rpc( p_dealer_id uuid, p_actor uuid, p_customer_id uuid, p_reference_date date ) RETURNS public.monthly_statements LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'enforce_invoice_cancel_not_in_issued_statement', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.enforce_invoice_cancel_not_in_issued_statement() RETURNS trigger LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'enforce_invoice_delete_is_draft', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.enforce_invoice_delete_is_draft() RETURNS trigger LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'enforce_invoice_insert_is_draft', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.enforce_invoice_insert_is_draft() RETURNS trigger LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'enforce_invoice_issued_immutability', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.enforce_invoice_issued_immutability() RETURNS trigger LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'enforce_invoice_items_issued_immutability', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.enforce_invoice_items_issued_immutability() RETURNS trigger LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'enforce_monthly_statement_adjustment_rules', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.enforce_monthly_statement_adjustment_rules() RETURNS trigger LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'enforce_monthly_statement_line_rules', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.enforce_monthly_statement_line_rules() RETURNS trigger LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'enforce_monthly_statement_no_hard_delete', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.enforce_monthly_statement_no_hard_delete() RETURNS trigger LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'enforce_monthly_statement_pdf_pointer', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.enforce_monthly_statement_pdf_pointer() RETURNS trigger LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'enforce_monthly_statement_receipt_rules', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.enforce_monthly_statement_receipt_rules() RETURNS trigger LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'enforce_monthly_statement_rules', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.enforce_monthly_statement_rules() RETURNS trigger LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'enforce_payment_allocation_rules', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.enforce_payment_allocation_rules() RETURNS trigger LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'enforce_payment_authoritative_scope', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.enforce_payment_authoritative_scope() RETURNS trigger LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'enforce_payment_direct_invoice_cap', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.enforce_payment_direct_invoice_cap() RETURNS trigger LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'enforce_payment_not_in_issued_statement', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.enforce_payment_not_in_issued_statement() RETURNS trigger LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'enforce_protected_artifact_rows', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.enforce_protected_artifact_rows() RETURNS trigger LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'get_next_document_number', 'uuid, text, integer, text, integer, text', 'integer', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=pg_catalog, public']::text[], 'CREATE OR REPLACE FUNCTION public.get_next_document_number( p_dealer_id uuid, p_sequence_type text, p_fiscal_year integer, p_prefix text DEFAULT '''', p_padding integer DEFAULT 5, p_reset_policy text DEFAULT ''never'' ) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public'),
  ('public', 'issue_monthly_statement_rpc', 'uuid, uuid', 'public.monthly_statements', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.issue_monthly_statement_rpc(p_statement_id uuid, p_issued_by uuid) RETURNS public.monthly_statements LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'pg_version', '', 'text', 'sql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public']::text[], 'CREATE OR REPLACE FUNCTION public.pg_version() RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public'),
  ('public', 'record_payment_with_allocations_rpc', 'uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, date, text, text, text, text, text, text, text, jsonb', 'public.payments', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.record_payment_with_allocations_rpc( p_dealer_id uuid, p_actor uuid, p_mode text, p_invoice_id uuid, p_customer_id uuid, p_amount numeric, p_fee_amount numeric, p_net_amount numeric, p_payment_date date, p_payment_method text, p_status text, p_payment_number text, p_reference_no text, p_notes text, p_internal_memo text, p_idempotency_key text, p_allocations jsonb ) RETURNS public.payments LANGUAGE plpgsql SET search_path = '''''),
  ('public', 'save_estimate_from_wizard', 'uuid, uuid, jsonb', 'jsonb', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=pg_catalog, public, pg_temp']::text[], 'CREATE OR REPLACE FUNCTION public.save_estimate_from_wizard( p_dealer_id uuid, p_actor_user_id uuid, p_payload jsonb ) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp'),
  ('public', 'save_invoice_draft', 'uuid, uuid, jsonb, jsonb', 'jsonb', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=""']::text[], 'CREATE OR REPLACE FUNCTION public.save_invoice_draft( p_invoice_id uuid, p_dealer_id uuid, p_fields jsonb, p_items jsonb ) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '''''),
  ('public', 'update_billing_updated_at', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.update_billing_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog'),
  ('public', 'update_dealer_stock_levels_updated_at', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.update_dealer_stock_levels_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog'),
  ('public', 'update_ocr_sessions_updated_at', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.update_ocr_sessions_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog'),
  ('public', 'update_staging_updated_at', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.update_staging_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog'),
  ('public', 'update_uat_updated_at', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.update_uat_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog'),
  ('public', 'update_updated_at_column', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog'),
  ('public', 'update_vehicle_registration_files_updated_at', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.update_vehicle_registration_files_updated_at() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = pg_catalog'),
  ('public', 'wiz_archive_catalog_item', 'uuid, uuid', 'jsonb', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_archive_catalog_item( p_expected_dealer uuid, p_item_id uuid ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_archive_ppf_coating_adjustment', 'uuid, uuid', 'jsonb', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_archive_ppf_coating_adjustment( p_expected_dealer uuid, p_rule_id uuid ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_bump_dealer_revision', 'uuid', 'void', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_bump_dealer_revision(p_dealer uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_can_configure', 'uuid', 'boolean', 'sql', TRUE, 's', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_can_configure(d uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_confirm_catalog_review', 'uuid', 'jsonb', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_confirm_catalog_review( p_expected_dealer uuid ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_document_fiscal_year', 'text, timestamp with time zone', 'integer', 'sql', FALSE, 's', 'u', FALSE, TRUE, ARRAY['search_path=pg_catalog, public']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_document_fiscal_year( p_reset_policy text, p_at timestamptz ) RETURNS integer LANGUAGE sql STABLE STRICT SECURITY INVOKER SET search_path = pg_catalog, public'),
  ('public', 'wiz_format_document_number', 'text, integer, integer, integer', 'text', 'plpgsql', FALSE, 'i', 'u', FALSE, TRUE, ARRAY['search_path=pg_catalog, public']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_format_document_number( p_prefix text, p_number integer, p_padding integer, p_fiscal_year integer ) RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT SECURITY INVOKER SET search_path = pg_catalog, public'),
  ('public', 'wiz_guard_catalog_item', '', 'trigger', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_guard_catalog_item() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_guard_catalog_item_immutable', '', 'trigger', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_guard_catalog_item_immutable() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_guard_dealers_product_mode', '', 'trigger', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_guard_dealers_product_mode() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_guard_estimate_item_dml', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=pg_catalog, public, pg_temp']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_guard_estimate_item_dml() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp'),
  ('public', 'wiz_guard_estimate_update', '', 'trigger', 'plpgsql', FALSE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=pg_catalog, public, pg_temp']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_guard_estimate_update() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp'),
  ('public', 'wiz_guard_override', '', 'trigger', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_guard_override() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_init_dealer_lifecycle', '', 'trigger', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_init_dealer_lifecycle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_invalidate_on_global_catalog_change', '', 'trigger', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_invalidate_on_global_catalog_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_invalidate_on_offering_change', '', 'trigger', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_invalidate_on_offering_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_invalidate_on_override_change', '', 'trigger', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_invalidate_on_override_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_invalidate_on_rank_change', '', 'trigger', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_invalidate_on_rank_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_invalidate_on_settings_change', '', 'trigger', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_invalidate_on_settings_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_is_active_member', 'uuid', 'boolean', 'sql', TRUE, 's', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_is_active_member(d uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_is_any_active_member', '', 'boolean', 'sql', TRUE, 's', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_is_any_active_member() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_is_wizard_estimate', 'text, text, text', 'boolean', 'sql', FALSE, 'i', 'u', FALSE, FALSE, ARRAY['search_path=pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_is_wizard_estimate( p_source text, p_idempotency_key text, p_schema_version text ) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog'),
  ('public', 'wiz_reject_hard_delete', '', 'trigger', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_reject_hard_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_revalidate_items_for_kind', '', 'trigger', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_revalidate_items_for_kind() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_revalidate_items_for_mode', '', 'trigger', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_revalidate_items_for_mode() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_upsert_catalog_item', 'uuid, uuid, text, jsonb', 'jsonb', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_upsert_catalog_item( p_expected_dealer uuid, p_item_id uuid, p_kind text, p_payload jsonb ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_upsert_ppf_coating_adjustment', 'uuid, uuid, jsonb', 'jsonb', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_upsert_ppf_coating_adjustment( p_expected_dealer uuid, p_rule_id uuid, p_payload jsonb ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_validate_catalog_item', 'uuid', 'void', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_validate_catalog_item(p_item_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_validate_item_child_trigger', '', 'trigger', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_validate_item_child_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog'),
  ('public', 'wiz_validate_item_trigger', '', 'trigger', 'plpgsql', TRUE, 'v', 'u', FALSE, FALSE, ARRAY['search_path=public, pg_catalog']::text[], 'CREATE OR REPLACE FUNCTION public.wiz_validate_item_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog');

-- ============================================================
-- expected_trigger (59 rows) -- source: catalog_manifest.test.sql
-- ============================================================
create temp table expected_trigger (
  schema text,
  relation text,
  trigger_name text,
  timing text,
  orientation text,
  events text[],
  when_expression text,
  referencing_clause text,
  is_constraint_trigger boolean,
  deferrable_flag boolean,
  initially_deferred boolean,
  target_function_name text,
  target_function_identity_argument_types text,
  tgenabled text,
  normalized_definition text
) on commit drop;

insert into expected_trigger
  (schema, relation, trigger_name, timing, orientation, events,
   when_expression, referencing_clause, is_constraint_trigger,
   deferrable_flag, initially_deferred, target_function_name,
   target_function_identity_argument_types, tgenabled, normalized_definition)
values
  ('public', 'customer_app_settings', 'trg_customer_app_settings_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_updated_at_column', '', 'O', 'CREATE TRIGGER trg_customer_app_settings_updated_at BEFORE UPDATE ON public.customer_app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'),
  ('public', 'dealer_billing', 'trg_dealer_billing_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_billing_updated_at', '', 'O', 'CREATE TRIGGER trg_dealer_billing_updated_at BEFORE UPDATE ON dealer_billing FOR EACH ROW EXECUTE FUNCTION update_billing_updated_at()'),
  ('public', 'dealer_ppf_coating_adjustments', 'trg_dpca_wiz_invalidate_ins', 'AFTER', 'STATEMENT', ARRAY['INSERT']::text[], NULL, 'NEW TABLE AS chg', FALSE, FALSE, FALSE, 'wiz_invalidate_on_override_change', '', 'O', 'CREATE TRIGGER trg_dpca_wiz_invalidate_ins AFTER INSERT ON public.dealer_ppf_coating_adjustments REFERENCING NEW TABLE AS chg FOR EACH STATEMENT EXECUTE FUNCTION public.wiz_invalidate_on_override_change()'),
  ('public', 'dealer_ppf_coating_adjustments', 'trg_dpca_wiz_invalidate_upd', 'AFTER', 'STATEMENT', ARRAY['UPDATE']::text[], NULL, 'NEW TABLE AS chg', FALSE, FALSE, FALSE, 'wiz_invalidate_on_override_change', '', 'O', 'CREATE TRIGGER trg_dpca_wiz_invalidate_upd AFTER UPDATE ON public.dealer_ppf_coating_adjustments REFERENCING NEW TABLE AS chg FOR EACH STATEMENT EXECUTE FUNCTION public.wiz_invalidate_on_override_change()'),
  ('public', 'dealer_service_offerings', 'trg_dso_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_updated_at_column', '', 'O', 'CREATE TRIGGER trg_dso_updated_at BEFORE UPDATE ON public.dealer_service_offerings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()'),
  ('public', 'dealer_service_offerings', 'trg_dso_wiz_invalidate', 'AFTER', 'ROW', ARRAY['INSERT', 'UPDATE', 'DELETE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'wiz_invalidate_on_offering_change', '', 'O', 'CREATE TRIGGER trg_dso_wiz_invalidate AFTER INSERT OR UPDATE OR DELETE ON public.dealer_service_offerings FOR EACH ROW EXECUTE FUNCTION public.wiz_invalidate_on_offering_change()'),
  ('public', 'dealer_settings', 'trg_dealer_settings_wiz_invalidate', 'AFTER', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'wiz_invalidate_on_settings_change', '', 'O', 'CREATE TRIGGER trg_dealer_settings_wiz_invalidate AFTER UPDATE ON public.dealer_settings FOR EACH ROW EXECUTE FUNCTION public.wiz_invalidate_on_settings_change()'),
  ('public', 'dealer_stock_levels', 'set_dealer_stock_levels_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_dealer_stock_levels_updated_at', '', 'O', 'CREATE TRIGGER set_dealer_stock_levels_updated_at BEFORE UPDATE ON dealer_stock_levels FOR EACH ROW EXECUTE FUNCTION update_dealer_stock_levels_updated_at()'),
  ('public', 'dealer_wizard_catalog_lifecycle', 'trg_dwcl_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_updated_at_column', '', 'O', 'CREATE TRIGGER trg_dwcl_updated_at BEFORE UPDATE ON public.dealer_wizard_catalog_lifecycle FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()'),
  ('public', 'dealer_wizard_catalog_overrides', 'trg_dwco_guard', 'BEFORE', 'ROW', ARRAY['INSERT', 'UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'wiz_guard_override', '', 'O', 'CREATE TRIGGER trg_dwco_guard BEFORE INSERT OR UPDATE ON public.dealer_wizard_catalog_overrides FOR EACH ROW EXECUTE FUNCTION public.wiz_guard_override()'),
  ('public', 'dealer_wizard_catalog_overrides', 'trg_dwco_wiz_invalidate_del', 'AFTER', 'STATEMENT', ARRAY['DELETE']::text[], NULL, 'OLD TABLE AS chg', FALSE, FALSE, FALSE, 'wiz_invalidate_on_override_change', '', 'O', 'CREATE TRIGGER trg_dwco_wiz_invalidate_del AFTER DELETE ON public.dealer_wizard_catalog_overrides REFERENCING OLD TABLE AS chg FOR EACH STATEMENT EXECUTE FUNCTION public.wiz_invalidate_on_override_change()'),
  ('public', 'dealer_wizard_catalog_overrides', 'trg_dwco_wiz_invalidate_ins', 'AFTER', 'STATEMENT', ARRAY['INSERT']::text[], NULL, 'NEW TABLE AS chg', FALSE, FALSE, FALSE, 'wiz_invalidate_on_override_change', '', 'O', 'CREATE TRIGGER trg_dwco_wiz_invalidate_ins AFTER INSERT ON public.dealer_wizard_catalog_overrides REFERENCING NEW TABLE AS chg FOR EACH STATEMENT EXECUTE FUNCTION public.wiz_invalidate_on_override_change()'),
  ('public', 'dealer_wizard_catalog_overrides', 'trg_dwco_wiz_invalidate_upd', 'AFTER', 'STATEMENT', ARRAY['UPDATE']::text[], NULL, 'NEW TABLE AS chg', FALSE, FALSE, FALSE, 'wiz_invalidate_on_override_change', '', 'O', 'CREATE TRIGGER trg_dwco_wiz_invalidate_upd AFTER UPDATE ON public.dealer_wizard_catalog_overrides REFERENCING NEW TABLE AS chg FOR EACH STATEMENT EXECUTE FUNCTION public.wiz_invalidate_on_override_change()'),
  ('public', 'dealers', 'trg_dealers_product_mode_guard', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'wiz_guard_dealers_product_mode', '', 'O', 'CREATE TRIGGER trg_dealers_product_mode_guard BEFORE UPDATE ON public.dealers FOR EACH ROW EXECUTE FUNCTION public.wiz_guard_dealers_product_mode()'),
  ('public', 'dealers', 'trg_dealers_wiz_lifecycle_init', 'AFTER', 'ROW', ARRAY['INSERT']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'wiz_init_dealer_lifecycle', '', 'O', 'CREATE TRIGGER trg_dealers_wiz_lifecycle_init AFTER INSERT ON public.dealers FOR EACH ROW EXECUTE FUNCTION public.wiz_init_dealer_lifecycle()'),
  ('public', 'dealers', 'trg_dealers_wiz_rank_invalidate', 'AFTER', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'wiz_invalidate_on_rank_change', '', 'O', 'CREATE TRIGGER trg_dealers_wiz_rank_invalidate AFTER UPDATE ON public.dealers FOR EACH ROW EXECUTE FUNCTION public.wiz_invalidate_on_rank_change()'),
  ('public', 'document_files', 'trg_protected_artifact_rows', 'BEFORE', 'ROW', ARRAY['INSERT', 'UPDATE', 'DELETE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'enforce_protected_artifact_rows', '', 'O', 'CREATE TRIGGER trg_protected_artifact_rows BEFORE INSERT OR UPDATE OR DELETE ON public.document_files FOR EACH ROW EXECUTE FUNCTION public.enforce_protected_artifact_rows()'),
  ('public', 'document_sequences', 'trg_document_sequences_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_updated_at_column', '', 'O', 'CREATE TRIGGER trg_document_sequences_updated_at BEFORE UPDATE ON document_sequences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'),
  ('public', 'estimate_items', 'wiz_guard_estimate_item_dml_trg', 'BEFORE', 'ROW', ARRAY['INSERT', 'UPDATE', 'DELETE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'wiz_guard_estimate_item_dml', '', 'O', 'CREATE TRIGGER wiz_guard_estimate_item_dml_trg BEFORE INSERT OR UPDATE OR DELETE ON public.estimate_items FOR EACH ROW EXECUTE FUNCTION public.wiz_guard_estimate_item_dml()'),
  ('public', 'estimates', 'wiz_guard_estimate_update_trg', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'wiz_guard_estimate_update', '', 'O', 'CREATE TRIGGER wiz_guard_estimate_update_trg BEFORE UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.wiz_guard_estimate_update()'),
  ('public', 'gyeon_news', 'trg_gyeon_news_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_updated_at_column', '', 'O', 'CREATE TRIGGER trg_gyeon_news_updated_at BEFORE UPDATE ON public.gyeon_news FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'),
  ('public', 'gyeon_products', 'trg_gyeon_products_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_updated_at_column', '', 'O', 'CREATE TRIGGER trg_gyeon_products_updated_at BEFORE UPDATE ON public.gyeon_products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'),
  ('public', 'gyeon_resources', 'trg_gyeon_resources_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_updated_at_column', '', 'O', 'CREATE TRIGGER trg_gyeon_resources_updated_at BEFORE UPDATE ON public.gyeon_resources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'),
  ('public', 'invoice_items', 'invoice_items_bump_content_version', 'AFTER', 'ROW', ARRAY['INSERT', 'UPDATE', 'DELETE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'bump_invoice_content_version', '', 'O', 'create trigger invoice_items_bump_content_version after insert or update or delete on public.invoice_items for each row execute function public.bump_invoice_content_version()'),
  ('public', 'invoice_items', 'invoice_items_issued_immutability', 'BEFORE', 'ROW', ARRAY['INSERT', 'UPDATE', 'DELETE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'enforce_invoice_items_issued_immutability', '', 'O', 'create trigger invoice_items_issued_immutability before insert or update or delete on public.invoice_items for each row execute function public.enforce_invoice_items_issued_immutability()'),
  ('public', 'invoices', 'invoices_delete_is_draft', 'BEFORE', 'ROW', ARRAY['DELETE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'enforce_invoice_delete_is_draft', '', 'O', 'create trigger invoices_delete_is_draft before delete on public.invoices for each row execute function public.enforce_invoice_delete_is_draft()'),
  ('public', 'invoices', 'invoices_insert_is_draft', 'BEFORE', 'ROW', ARRAY['INSERT']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'enforce_invoice_insert_is_draft', '', 'O', 'create trigger invoices_insert_is_draft before insert on public.invoices for each row execute function public.enforce_invoice_insert_is_draft()'),
  ('public', 'invoices', 'invoices_issued_immutability', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'enforce_invoice_issued_immutability', '', 'O', 'create trigger invoices_issued_immutability before update on public.invoices for each row execute function public.enforce_invoice_issued_immutability()'),
  ('public', 'invoices', 'trg_invoice_cancel_not_in_issued_statement', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'enforce_invoice_cancel_not_in_issued_statement', '', 'O', 'create trigger trg_invoice_cancel_not_in_issued_statement before update on public.invoices for each row execute function public.enforce_invoice_cancel_not_in_issued_statement()'),
  ('public', 'monthly_statement_adjustments', 'trg_monthly_statement_adjustment_rules', 'BEFORE', 'ROW', ARRAY['INSERT', 'UPDATE', 'DELETE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'enforce_monthly_statement_adjustment_rules', '', 'O', 'drop trigger if exists trg_monthly_statement_adjustment_rules on public.monthly_statement_adjustments; create trigger trg_monthly_statement_adjustment_rules before insert or update or delete on public.monthly_statement_adjustments for each row execute function public.enforce_monthly_statement_adjustment_rules()'),
  ('public', 'monthly_statement_lines', 'trg_monthly_statement_line_rules', 'BEFORE', 'ROW', ARRAY['INSERT', 'UPDATE', 'DELETE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'enforce_monthly_statement_line_rules', '', 'O', 'create trigger trg_monthly_statement_line_rules before insert or update or delete on public.monthly_statement_lines for each row execute function public.enforce_monthly_statement_line_rules()'),
  ('public', 'monthly_statement_receipts', 'trg_monthly_statement_receipt_rules', 'BEFORE', 'ROW', ARRAY['INSERT', 'UPDATE', 'DELETE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'enforce_monthly_statement_receipt_rules', '', 'O', 'create trigger trg_monthly_statement_receipt_rules before insert or update or delete on public.monthly_statement_receipts for each row execute function public.enforce_monthly_statement_receipt_rules()'),
  ('public', 'monthly_statements', 'trg_monthly_statement_no_hard_delete', 'BEFORE', 'ROW', ARRAY['DELETE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'enforce_monthly_statement_no_hard_delete', '', 'O', 'create trigger trg_monthly_statement_no_hard_delete before delete on public.monthly_statements for each row execute function public.enforce_monthly_statement_no_hard_delete()'),
  ('public', 'monthly_statements', 'trg_monthly_statement_pdf_pointer', 'BEFORE', 'ROW', ARRAY['INSERT', 'UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'enforce_monthly_statement_pdf_pointer', '', 'O', 'create trigger trg_monthly_statement_pdf_pointer before insert or update on public.monthly_statements for each row execute function public.enforce_monthly_statement_pdf_pointer()'),
  ('public', 'monthly_statements', 'trg_monthly_statement_rules', 'BEFORE', 'ROW', ARRAY['INSERT', 'UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'enforce_monthly_statement_rules', '', 'O', 'create trigger trg_monthly_statement_rules before insert or update on public.monthly_statements for each row execute function public.enforce_monthly_statement_rules()'),
  ('public', 'news_delivery_jobs', 'trg_news_delivery_jobs_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_updated_at_column', '', 'O', 'CREATE TRIGGER trg_news_delivery_jobs_updated_at BEFORE UPDATE ON public.news_delivery_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'),
  ('public', 'news_delivery_recipients', 'trg_news_delivery_recipients_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_updated_at_column', '', 'O', 'CREATE TRIGGER trg_news_delivery_recipients_updated_at BEFORE UPDATE ON public.news_delivery_recipients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'),
  ('public', 'payment_allocations', 'trg_payment_allocation_rules', 'BEFORE', 'ROW', ARRAY['INSERT', 'UPDATE', 'DELETE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'enforce_payment_allocation_rules', '', 'O', 'create trigger trg_payment_allocation_rules before insert or update or delete on public.payment_allocations for each row execute function public.enforce_payment_allocation_rules()'),
  ('public', 'payments', 'trg_payment_authoritative_scope', 'BEFORE', 'ROW', ARRAY['INSERT', 'UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'enforce_payment_authoritative_scope', '', 'O', 'create trigger trg_payment_authoritative_scope before insert or update on public.payments for each row execute function public.enforce_payment_authoritative_scope()'),
  ('public', 'payments', 'trg_payment_direct_invoice_cap', 'BEFORE', 'ROW', ARRAY['INSERT', 'UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'enforce_payment_direct_invoice_cap', '', 'O', 'create trigger trg_payment_direct_invoice_cap before insert or update on public.payments for each row execute function public.enforce_payment_direct_invoice_cap()'),
  ('public', 'payments', 'trg_payment_not_in_issued_statement', 'BEFORE', 'ROW', ARRAY['UPDATE', 'DELETE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'enforce_payment_not_in_issued_statement', '', 'O', 'create trigger trg_payment_not_in_issued_statement before update or delete on public.payments for each row execute function public.enforce_payment_not_in_issued_statement()'),
  ('public', 'point_cards', 'trg_point_cards_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_updated_at_column', '', 'O', 'CREATE TRIGGER trg_point_cards_updated_at BEFORE UPDATE ON public.point_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'),
  ('public', 'product_orders', 'trg_product_orders_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_updated_at_column', '', 'O', 'CREATE TRIGGER trg_product_orders_updated_at BEFORE UPDATE ON public.product_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'),
  ('public', 'staging_issues', 'staging_issues_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_staging_updated_at', '', 'O', 'create trigger staging_issues_updated_at before update on staging_issues for each row execute function update_staging_updated_at()'),
  ('public', 'staging_verification_items', 'staging_verification_items_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_staging_updated_at', '', 'O', 'create trigger staging_verification_items_updated_at before update on staging_verification_items for each row execute function update_staging_updated_at()'),
  ('public', 'staging_verification_runs', 'staging_verification_runs_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_staging_updated_at', '', 'O', 'create trigger staging_verification_runs_updated_at before update on staging_verification_runs for each row execute function update_staging_updated_at()'),
  ('public', 'uat_dealers', 'uat_dealers_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_uat_updated_at', '', 'O', 'create trigger uat_dealers_updated_at before update on uat_dealers for each row execute function update_uat_updated_at()'),
  ('public', 'vehicle_registration_files', 'set_vehicle_registration_files_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_vehicle_registration_files_updated_at', '', 'O', 'CREATE TRIGGER set_vehicle_registration_files_updated_at BEFORE UPDATE ON vehicle_registration_files FOR EACH ROW EXECUTE FUNCTION update_vehicle_registration_files_updated_at()'),
  ('public', 'vehicle_registration_ocr_sessions', 'set_ocr_sessions_updated_at', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'update_ocr_sessions_updated_at', '', 'O', 'CREATE TRIGGER set_ocr_sessions_updated_at BEFORE UPDATE ON vehicle_registration_ocr_sessions FOR EACH ROW EXECUTE FUNCTION update_ocr_sessions_updated_at()'),
  ('public', 'wizard_catalog_item_categories', 'trg_wcic_validate', 'AFTER', 'ROW', ARRAY['INSERT', 'UPDATE', 'DELETE']::text[], NULL, NULL, TRUE, TRUE, TRUE, 'wiz_validate_item_child_trigger', '', 'O', 'CREATE CONSTRAINT TRIGGER trg_wcic_validate AFTER INSERT OR UPDATE OR DELETE ON public.wizard_catalog_item_categories DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.wiz_validate_item_child_trigger()'),
  ('public', 'wizard_catalog_item_ranks', 'trg_wcir_validate', 'AFTER', 'ROW', ARRAY['INSERT', 'UPDATE', 'DELETE']::text[], NULL, NULL, TRUE, TRUE, TRUE, 'wiz_validate_item_child_trigger', '', 'O', 'CREATE CONSTRAINT TRIGGER trg_wcir_validate AFTER INSERT OR UPDATE OR DELETE ON public.wizard_catalog_item_ranks DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.wiz_validate_item_child_trigger()'),
  ('public', 'wizard_catalog_items', 'trg_wci_guard', 'BEFORE', 'ROW', ARRAY['INSERT', 'UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'wiz_guard_catalog_item', '', 'O', 'CREATE TRIGGER trg_wci_guard BEFORE INSERT OR UPDATE ON public.wizard_catalog_items FOR EACH ROW EXECUTE FUNCTION public.wiz_guard_catalog_item()'),
  ('public', 'wizard_catalog_items', 'trg_wci_immutable', 'BEFORE', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'wiz_guard_catalog_item_immutable', '', 'O', 'CREATE TRIGGER trg_wci_immutable BEFORE UPDATE ON public.wizard_catalog_items FOR EACH ROW EXECUTE FUNCTION public.wiz_guard_catalog_item_immutable()'),
  ('public', 'wizard_catalog_items', 'trg_wci_no_hard_delete', 'BEFORE', 'ROW', ARRAY['DELETE']::text[], NULL, NULL, FALSE, FALSE, FALSE, 'wiz_reject_hard_delete', '', 'O', 'CREATE TRIGGER trg_wci_no_hard_delete BEFORE DELETE ON public.wizard_catalog_items FOR EACH ROW EXECUTE FUNCTION public.wiz_reject_hard_delete()'),
  ('public', 'wizard_catalog_items', 'trg_wci_validate', 'AFTER', 'ROW', ARRAY['INSERT', 'UPDATE']::text[], NULL, NULL, TRUE, TRUE, TRUE, 'wiz_validate_item_trigger', '', 'O', 'CREATE CONSTRAINT TRIGGER trg_wci_validate AFTER INSERT OR UPDATE ON public.wizard_catalog_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.wiz_validate_item_trigger()'),
  ('public', 'wizard_catalog_items', 'trg_wci_wiz_invalidate_global_ins', 'AFTER', 'STATEMENT', ARRAY['INSERT']::text[], NULL, 'NEW TABLE AS chg', FALSE, FALSE, FALSE, 'wiz_invalidate_on_global_catalog_change', '', 'O', 'CREATE TRIGGER trg_wci_wiz_invalidate_global_ins AFTER INSERT ON public.wizard_catalog_items REFERENCING NEW TABLE AS chg FOR EACH STATEMENT EXECUTE FUNCTION public.wiz_invalidate_on_global_catalog_change()'),
  ('public', 'wizard_catalog_items', 'trg_wci_wiz_invalidate_global_upd', 'AFTER', 'STATEMENT', ARRAY['UPDATE']::text[], NULL, 'NEW TABLE AS chg', FALSE, FALSE, FALSE, 'wiz_invalidate_on_global_catalog_change', '', 'O', 'CREATE TRIGGER trg_wci_wiz_invalidate_global_upd AFTER UPDATE ON public.wizard_catalog_items REFERENCING NEW TABLE AS chg FOR EACH STATEMENT EXECUTE FUNCTION public.wiz_invalidate_on_global_catalog_change()'),
  ('public', 'wizard_kind_policy', 'trg_wkp_revalidate', 'AFTER', 'ROW', ARRAY['UPDATE']::text[], NULL, NULL, TRUE, TRUE, TRUE, 'wiz_revalidate_items_for_kind', '', 'O', 'CREATE CONSTRAINT TRIGGER trg_wkp_revalidate AFTER UPDATE ON public.wizard_kind_policy DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.wiz_revalidate_items_for_kind()'),
  ('public', 'wizard_rank_category_policy', 'trg_wrcp_revalidate', 'AFTER', 'ROW', ARRAY['UPDATE', 'DELETE']::text[], NULL, NULL, TRUE, TRUE, TRUE, 'wiz_revalidate_items_for_mode', '', 'O', 'CREATE CONSTRAINT TRIGGER trg_wrcp_revalidate AFTER UPDATE OR DELETE ON public.wizard_rank_category_policy DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.wiz_revalidate_items_for_mode()');

-- ============================================================
-- expected_function_execute_acl (24 rows) -- source: catalog_manifest.test.sql
-- ============================================================
create temp table expected_function_execute_acl (
  function_schema text NOT NULL,
  function_name text NOT NULL,
  identity_argument_types text NOT NULL,
  grantee text NOT NULL,
  privilege_type text NOT NULL,
  is_grantable boolean NOT NULL
) on commit drop;
INSERT INTO expected_function_execute_acl (function_schema, function_name, identity_argument_types, grantee, privilege_type, is_grantable) VALUES
  ('public', 'attach_monthly_statement_pdf_rpc', 'uuid, uuid, uuid', 'service_role', 'EXECUTE', FALSE),
  ('public', 'b3_recalc_invoice_payment', 'uuid', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'b3_recalc_invoice_payment', 'uuid', 'service_role', 'EXECUTE', FALSE),
  ('public', 'convert_payment_to_allocated_rpc', 'uuid, uuid, uuid, jsonb', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'convert_payment_to_allocated_rpc', 'uuid, uuid, uuid, jsonb', 'service_role', 'EXECUTE', FALSE),
  ('public', 'create_monthly_statement_draft_rpc', 'uuid, uuid, uuid, date', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'get_next_document_number', 'uuid, text, integer, text, integer, text', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'issue_monthly_statement_rpc', 'uuid, uuid', 'service_role', 'EXECUTE', FALSE),
  ('public', 'pg_version', '', 'service_role', 'EXECUTE', FALSE),
  ('public', 'record_payment_with_allocations_rpc', 'uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, date, text, text, text, text, text, text, text, jsonb', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'record_payment_with_allocations_rpc', 'uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, date, text, text, text, text, text, text, text, jsonb', 'service_role', 'EXECUTE', FALSE),
  ('public', 'save_estimate_from_wizard', 'uuid, uuid, jsonb', 'service_role', 'EXECUTE', FALSE),
  ('public', 'save_invoice_draft', 'uuid, uuid, jsonb, jsonb', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_archive_catalog_item', 'uuid, uuid', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_archive_ppf_coating_adjustment', 'uuid, uuid', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_can_configure', 'uuid', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_confirm_catalog_review', 'uuid', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_document_fiscal_year', 'text, timestamp with time zone', 'service_role', 'EXECUTE', FALSE),
  ('public', 'wiz_format_document_number', 'text, integer, integer, integer', 'service_role', 'EXECUTE', FALSE),
  ('public', 'wiz_is_active_member', 'uuid', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_is_any_active_member', '', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_is_wizard_estimate', 'text, text, text', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_upsert_catalog_item', 'uuid, uuid, text, jsonb', 'authenticated', 'EXECUTE', FALSE),
  ('public', 'wiz_upsert_ppf_coating_adjustment', 'uuid, uuid, jsonb', 'authenticated', 'EXECUTE', FALSE);

-- ============================================================
-- actual_function / actual_trigger (live catalog snapshot)
-- ============================================================
create temp table actual_function as
select
  n.nspname::text as schema,
  p.proname::text as name,
  oidvectortypes(p.proargtypes) as identity_argument_types,
  case
    when rtn.nspname = 'pg_catalog' then pg_catalog.format_type(p.prorettype, null)
    else format('%I.%I', rtn.nspname, rt.typname)
  end as result_type,
  l.lanname::text as language,
  p.prosecdef as security_definer,
  p.provolatile::text as provolatile,
  p.proparallel::text as proparallel,
  p.proleakproof as leakproof,
  p.proisstrict as strict,
  p.proconfig as proconfig_in_order,
  pg_get_functiondef(p.oid) as normalized_definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
join pg_type rt on rt.oid = p.prorettype
join pg_namespace rtn on rtn.oid = rt.typnamespace
where n.nspname = 'public'
  and p.prokind = 'f';

create temp table actual_trigger as
select
  n.nspname::text as schema,
  c.relname::text as relation,
  t.tgname::text as trigger_name,
  case when (t.tgtype::int & 2) = 2 then 'BEFORE'
       when (t.tgtype::int & 64) = 64 then 'INSTEAD OF'
       else 'AFTER'
  end as timing,
  case when (t.tgtype::int & 1) = 1 then 'ROW' else 'STATEMENT' end as orientation,
  (
    select array_agg(ev order by ord)
    from (
      select 1 as ord, 'INSERT' as ev where (t.tgtype::int & 4) = 4
      union all
      select 2, 'UPDATE' where (t.tgtype::int & 16) = 16
      union all
      select 3, 'DELETE' where (t.tgtype::int & 8) = 8
      union all
      select 4, 'TRUNCATE' where (t.tgtype::int & 32) = 32
    ) events
  ) as events,
  pg_get_expr(t.tgqual, t.tgrelid, true) as when_expression,
  nullif(
    trim(
      coalesce('OLD TABLE AS ' || nullif(t.tgoldtable::text, ''), '') ||
      case when t.tgoldtable is not null and t.tgnewtable is not null then ' ' else '' end ||
      coalesce('NEW TABLE AS ' || nullif(t.tgnewtable::text, ''), '')
    ),
    ''
  ) as referencing_clause,
  t.tgconstraint <> 0 as is_constraint_trigger,
  t.tgdeferrable as deferrable_flag,
  t.tginitdeferred as initially_deferred,
  fp.proname::text as target_function_name,
  pg_get_function_identity_arguments(fp.oid) as target_function_identity_argument_types,
  t.tgenabled::text as tgenabled,
  pg_get_triggerdef(t.oid, true) as normalized_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc fp on fp.oid = t.tgfoid
where n.nspname = 'public'
  and not t.tgisinternal;

-- ============================================================
-- 1: function EXACT_COUNT
-- ============================================================
select is(
  (select count(*)::int from actual_function),
  64,
  '1: actual_function row count is 64'
);

-- 2: function NO_MISSING (normalized_definition excluded per
-- R12C_FT_BLOCKER.md, same exclusion as catalog_manifest.test.sql 62/63)
select is_empty(
  $$
    select schema, name, identity_argument_types, result_type, language,
           security_definer, provolatile, proparallel, leakproof, strict,
           proconfig_in_order
    from expected_function
    except
    select schema, name, identity_argument_types, result_type, language,
           security_definer, provolatile, proparallel, leakproof, strict,
           proconfig_in_order
    from actual_function
  $$,
  '2: no function rows missing from actual vs expected (overload-safe identity, normalized_definition excluded per R12C_FT_BLOCKER.md)'
);

-- 3: function NO_UNEXPECTED
select is_empty(
  $$
    select schema, name, identity_argument_types, result_type, language,
           security_definer, provolatile, proparallel, leakproof, strict,
           proconfig_in_order
    from actual_function
    except
    select schema, name, identity_argument_types, result_type, language,
           security_definer, provolatile, proparallel, leakproof, strict,
           proconfig_in_order
    from expected_function
  $$,
  '3: no unexpected/extra function rows in actual vs expected (overload-safe identity, normalized_definition excluded per R12C_FT_BLOCKER.md)'
);

-- 4: function NO_DUPLICATE (overload-safe identity uniqueness)
select is_empty(
  $$
    select schema, name, identity_argument_types
    from actual_function
    group by schema, name, identity_argument_types
    having count(*) > 1
  $$,
  '4: no duplicate actual_function overload identities'
);

-- 5: function NO_WEAKER -- every accepted SECURITY DEFINER function must
-- retain its pinned search_path (proconfig_in_order unchanged)
select is_empty(
  $$
    select e.schema, e.name, e.identity_argument_types
    from expected_function e
    join actual_function a
      on a.schema = e.schema
     and a.name = e.name
     and a.identity_argument_types = e.identity_argument_types
    where e.security_definer = true
      and (a.proconfig_in_order is distinct from e.proconfig_in_order)
  $$,
  '5: no SECURITY DEFINER function weakened (pinned search_path/proconfig_in_order dropped or changed)'
);

-- 6: OWNER_CONTRACT_LABELED -- source-contract per 104_least_privilege_grants.sql
-- lines 357-366 (as already ratified in catalog_manifest.test.sql assertion 66).
-- This is only runtime-verified when executed against a live disposable
-- database; it documents the expected ownership contract for the gate.
select is(
  (
    select count(*)::int
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    join pg_authid a on a.oid = p.proowner
    where n.nspname = 'public'
      and p.prokind = 'f'
      and exists (
        select 1
        from expected_function e
        where e.schema = n.nspname
          and e.name = p.proname
          and e.identity_argument_types = oidvectortypes(p.proargtypes)
      )
      and a.rolname <> 'postgres'
  ),
  0,
  '6: OWNER_CONTRACT_LABELED all 64 public functions owned by postgres (source-contract, disposable-runtime-gate proof)'
);

-- 7: trigger EXACT_COUNT
select is(
  (select count(*)::int from actual_trigger),
  59,
  '7: actual_trigger row count is 59'
);

-- 8: trigger NO_MISSING (normalized_definition excluded per
-- R12C_FT_BLOCKER.md, same exclusion as catalog_manifest.test.sql 68/69)
select is_empty(
  $$
    select schema, relation, trigger_name, timing, orientation, events,
           when_expression, referencing_clause, is_constraint_trigger,
           deferrable_flag, initially_deferred, target_function_name,
           target_function_identity_argument_types, tgenabled
    from expected_trigger
    except
    select schema, relation, trigger_name, timing, orientation, events,
           when_expression, referencing_clause, is_constraint_trigger,
           deferrable_flag, initially_deferred, target_function_name,
           target_function_identity_argument_types, tgenabled
    from actual_trigger
  $$,
  '8: no trigger rows missing from actual vs expected (table/function binding included)'
);

-- 9: trigger NO_UNEXPECTED
select is_empty(
  $$
    select schema, relation, trigger_name, timing, orientation, events,
           when_expression, referencing_clause, is_constraint_trigger,
           deferrable_flag, initially_deferred, target_function_name,
           target_function_identity_argument_types, tgenabled
    from actual_trigger
    except
    select schema, relation, trigger_name, timing, orientation, events,
           when_expression, referencing_clause, is_constraint_trigger,
           deferrable_flag, initially_deferred, target_function_name,
           target_function_identity_argument_types, tgenabled
    from expected_trigger
  $$,
  '9: no unexpected/extra trigger rows in actual vs expected (table/function binding included)'
);

-- 10: trigger NO_DUPLICATE
select is_empty(
  $$
    select schema, relation, trigger_name
    from actual_trigger
    group by schema, relation, trigger_name
    having count(*) > 1
  $$,
  '10: no duplicate actual_trigger trigger identities'
);

-- 11: trigger NO_WEAKER -- enabled state ('O') and target function
-- binding must match exactly for every accepted trigger
select is_empty(
  $$
    select e.schema, e.relation, e.trigger_name
    from expected_trigger e
    join actual_trigger a
      on a.schema = e.schema
     and a.relation = e.relation
     and a.trigger_name = e.trigger_name
    where a.tgenabled <> 'O'
       or a.target_function_name <> e.target_function_name
       or a.target_function_identity_argument_types <> e.target_function_identity_argument_types
  $$,
  '11: no trigger weakened (disabled, or table/function binding changed)'
);

-- 12: ROLLBACK_LABELED -- bounded, deterministic structural precondition
-- for deferred-constraint rollback semantics grounded in the accepted
-- expected_trigger rows themselves: every accepted constraint trigger is
-- DEFERRABLE INITIALLY DEFERRED (a prerequisite for the transactional
-- rollback/audit-timing behavior that the disposable runtime gate proves
-- by execution per Section 14.5). No execution proof is fabricated here.
select is_empty(
  $$
    select schema, relation, trigger_name
    from expected_trigger
    where is_constraint_trigger = true
      and (deferrable_flag is distinct from true or initially_deferred is distinct from true)
  $$,
  '12: ROLLBACK_LABELED every accepted constraint trigger is deferrable/initially deferred (structural precondition; execution proof remains the disposable runtime gate)'
);

-- 13: AUDIT_LABELED -- bounded, deterministic check grounded in
-- expected_function itself: every accepted function runs in a
-- transactional PL language (plpgsql/sql), so rollback discards its
-- effects atomically. C-language/extension functions bypassing that
-- guarantee would require separate audit-effect proof; none are accepted.
select is_empty(
  $$
    select schema, name, identity_argument_types, language
    from expected_function
    where language not in ('plpgsql', 'sql')
  $$,
  '13: AUDIT_LABELED all 64 accepted functions use a transactional PL language (plpgsql/sql); no non-transactional audit-effect proof required'
);

-- 14: function_execute_acl EXACT_COUNT
select is(
  (select count(*)::bigint
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
     join pg_authid r on r.oid = a.grantee
    where n.nspname = 'public' and p.prokind = 'f'
      and r.rolname in ('authenticated', 'service_role')),
  24::bigint,
  '14: function_execute_acl EXACT_COUNT expected 24 canonical EXECUTE grant rows for the bounded application grantee set'
);

-- 15: function_execute_acl NO_MISSING
select is(
  (select count(*)::bigint from (
    select function_schema, function_name, identity_argument_types, grantee, privilege_type, is_grantable from expected_function_execute_acl
    except
    select n.nspname, p.proname, oidvectortypes(p.proargtypes), r.rolname, a.privilege_type, a.is_grantable
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      join pg_authid r on r.oid = a.grantee
     where n.nspname = 'public' and p.prokind = 'f' and r.rolname in ('authenticated', 'service_role')
  ) missing),
  0::bigint,
  '15: function_execute_acl NO_MISSING every canonical grant row must be present and matching in the live catalog'
);

-- 16: function_execute_acl NO_UNEXPECTED
select is(
  (select count(*)::bigint from (
    select n.nspname, p.proname, oidvectortypes(p.proargtypes), r.rolname, a.privilege_type, a.is_grantable
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      join pg_authid r on r.oid = a.grantee
     where n.nspname = 'public' and p.prokind = 'f' and r.rolname in ('authenticated', 'service_role')
    except
    select function_schema, function_name, identity_argument_types, grantee, privilege_type, is_grantable from expected_function_execute_acl
  ) unexpected),
  0::bigint,
  '16: function_execute_acl NO_UNEXPECTED no live grant row within the bounded grantee set may be absent from the canonical set'
);

-- 17: function_execute_acl NO_DUPLICATE
select is(
  (select count(*)::bigint from (
    select n.nspname, p.proname, oidvectortypes(p.proargtypes) as identity_argument_types, r.rolname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      join pg_authid r on r.oid = a.grantee
     where n.nspname = 'public' and p.prokind = 'f' and r.rolname in ('authenticated', 'service_role')
     group by n.nspname, p.proname, oidvectortypes(p.proargtypes), r.rolname
    having count(*) > 1
  ) dup),
  0::bigint,
  '17: function_execute_acl NO_DUPLICATE (function_schema,function_name,identity_argument_types,grantee) identity must be unique in the live catalog'
);

-- 18: function_execute_acl NO_WEAKER -- no WITH GRANT OPTION on the 24
-- canonical grants, and every non-canonical function identity denies
-- EXECUTE to authenticated/anon (least-privilege)
select is(
  (
    select
      (select count(*)
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
         join pg_authid r on r.oid = a.grantee
        where n.nspname = 'public' and p.prokind = 'f'
          and r.rolname in ('authenticated', 'service_role')
          and a.is_grantable)
      +
      (select count(*)
         from expected_function e
         join pg_proc p
           on p.proname = e.name
          and oidvectortypes(p.proargtypes) = e.identity_argument_types
         join pg_namespace n on n.oid = p.pronamespace and n.nspname = e.schema
         cross join (values ('authenticated'::text), ('anon'::text)) role_to_deny(rolename)
        where not exists (
          select 1
          from expected_function_execute_acl g
          where g.function_schema = e.schema
            and g.function_name = e.name
            and g.identity_argument_types = e.identity_argument_types
        )
          and has_function_privilege(role_to_deny.rolename, p.oid, 'EXECUTE'))
  )::bigint,
  0::bigint,
  '18: function_execute_acl NO_WEAKER no WITH GRANT OPTION on the 24 canonical grants and every zero-grant function identity denies authenticated/anon EXECUTE'
);

-- 19: NO_UNJUSTIFIED_PUBLIC_EXECUTE -- no public schema function may grant
-- EXECUTE to the PUBLIC pseudo-role; least-privilege is expressed only
-- through the bounded authenticated/service_role grantee set above
select is(
  (
    select count(*)::bigint
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where n.nspname = 'public' and p.prokind = 'f'
      and a.grantee = 0
  ),
  0::bigint,
  '19: NO_UNJUSTIFIED_PUBLIC_EXECUTE no public-schema function grants EXECUTE to the PUBLIC pseudo-role'
);

SELECT * FROM finish();

ROLLBACK;
