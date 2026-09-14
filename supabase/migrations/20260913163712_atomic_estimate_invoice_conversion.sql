-- Scoped estimate conversion, not a global one-invoice-per-estimate policy.
-- All callers of this RPC serialize on the estimate. Unrelated invoice creators
-- remain unchanged. A hard-deleted draft leaves no replay receipt; this RPC does
-- not promise durable identity across administrative deletion/relinking.
create function public.create_invoice_from_estimate_atomic(
  p_dealer_id uuid, p_estimate_id uuid, p_issue_date date, p_due_date date
) returns jsonb
language plpgsql security invoker
set search_path = ''
set extra_float_digits = 3
as $$
declare
  v_authorized boolean;
  v_est public.estimates%rowtype;
  v_invoice public.invoices%rowtype;
  v_seq public.document_sequences%rowtype;
  v_item record;
  v_items jsonb := '[]'::jsonb;
  v_source_items jsonb;
  v_count integer := 0;
  v_x double precision;
  v_line double precision;
  v_subtotal double precision := 0;
  v_discount double precision;
  v_tax_rate double precision;
  v_tax double precision;
  v_total double precision;
  v_prefix text := 'INV';
  v_padding integer := 5;
  v_reset text := 'never';
  v_period integer := 0;
  v_next integer;
  v_number text;
  v_id uuid;
begin
  -- Same dealer_staff precedence and finance rule as save_invoice_draft.
  select exists (
    select 1 from public.dealer_staff s where s.dealer_id = p_dealer_id
      and s.user_id = (select auth.uid()) and s.status = 'active'
      and s.role in ('owner', 'manager')
  ) or (not exists (
    select 1 from public.dealer_staff s where s.dealer_id = p_dealer_id
      and s.user_id = (select auth.uid())
  ) and exists (
    select 1 from public.dealer_members m where m.dealer_id = p_dealer_id
      and m.user_id = (select auth.uid()) and m.status = 'active'
      and m.role in ('owner', 'manager')
  )) into v_authorized;
  if not coalesce(v_authorized, false) or p_estimate_id is null then
    return jsonb_build_object('outcome', 'not-found');
  end if;

  select * into v_est from public.estimates
    where id = p_estimate_id and dealer_id = p_dealer_id and deleted_at is null
    for update;
  if not found then return jsonb_build_object('outcome', 'not-found'); end if;
  if v_est.status not in ('approved', 'APPROVED') then
    return jsonb_build_object('outcome', 'not-approved');
  end if;

  -- Include soft-deleted/cancelled records; neither is permission to recreate.
  -- Ordered locks also serialize against existing draft editing/issuance.
  for v_item in select * from public.invoices
    where dealer_id = p_dealer_id and estimate_id = p_estimate_id
    order by id for update
  loop
    v_count := v_count + 1;
    v_invoice := v_item;
  end loop;
  if v_count > 1 then return jsonb_build_object('outcome', 'conflict'); end if;
  if v_count = 1 then
    if v_invoice.deleted_at is not null or v_invoice.status = 'cancelled'
       or v_invoice.customer_id is distinct from v_est.customer_id
       or v_invoice.vehicle_id is distinct from v_est.vehicle_id
       or v_invoice.work_order_id is not null or v_invoice.completion_report_id is not null then
      return jsonb_build_object('outcome', 'conflict');
    end if;
    -- Existing is a review/reopen identity, not proof of full-estimate parity.
    return jsonb_build_object('outcome', 'existing', 'id', v_invoice.id);
  end if;
  if p_issue_date is null or not isfinite(p_issue_date)
     or (p_due_date is not null and not isfinite(p_due_date)) then
    return jsonb_build_object('outcome', 'invalid-input');
  end if;
  if v_est.customer_id is not null then
    perform 1 from public.customers where id = v_est.customer_id
      and dealer_id = p_dealer_id for share;
    if not found then return jsonb_build_object('outcome', 'not-found'); end if;
  end if;
  if v_est.vehicle_id is not null then
    perform 1 from public.vehicles where id = v_est.vehicle_id
      and dealer_id = p_dealer_id for share;
    if not found then return jsonb_build_object('outcome', 'not-found'); end if;
  end if;

  -- Capture all lines in ONE statement's MVCC snapshot. No child UPDATE
  -- privilege is needed (the existing grants intentionally withhold it).
  -- The parent remains locked: approval/header identity cannot change. Later
  -- line changes do not alter this captured copy or its calculated amounts.
  select coalesce(jsonb_agg(to_jsonb(i) order by i.id), '[]'::jsonb)
    into v_source_items from public.estimate_items i
    where i.estimate_id = p_estimate_id and i.dealer_id = p_dealer_id;
  for v_item in select * from jsonb_populate_recordset(null::public.estimate_items, v_source_items)
  loop
    -- Match Number/IEEE754 and lineTotal's Math.round (ties toward +infinity).
    -- floor(x + .5) is NOT equivalent at 0.49999999999999994.
    v_x := v_item.quantity::double precision * v_item.unit_price::double precision
      * (1::double precision - v_item.discount_rate::double precision / 100::double precision);
    if v_x::text in ('NaN', 'Infinity', '-Infinity') or abs(v_x) > 9007199254740991 then
      return jsonb_build_object('outcome', 'invalid-money');
    end if;
    v_line := floor(v_x);
    if v_x - v_line >= 0.5 then v_line := v_line + 1; end if;
    v_subtotal := v_subtotal + v_line;
    if abs(v_subtotal) > 9007199254740991 then
      return jsonb_build_object('outcome', 'invalid-money');
    end if;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'category', v_item.category, 'item_name', v_item.item_name,
      'description', nullif(v_item.description, ''), 'quantity', v_item.quantity,
      'unit_price', v_item.unit_price, 'discount_rate', v_item.discount_rate,
      'line_total', v_line::text::numeric, 'sort_order', v_item.sort_order));
  end loop;
  v_discount := coalesce(v_est.discount_amount, 0)::double precision;
  v_tax_rate := coalesce(v_est.tax_rate, 10)::double precision;
  if v_discount::text in ('NaN', 'Infinity', '-Infinity')
     or v_tax_rate::text in ('NaN', 'Infinity', '-Infinity')
     or abs(v_subtotal) > 9007199254740991 then
    return jsonb_build_object('outcome', 'invalid-money');
  end if;
  -- Same discount clamp and Math.floor tax as calculateInvoiceTotals. Keep the
  -- original stored discount field, as the existing conversion does.
  v_x := v_subtotal - least(greatest(0::double precision, v_discount), v_subtotal);
  v_tax := floor(v_x * v_tax_rate / 100::double precision);
  v_total := v_x + v_tax;
  if v_tax::text in ('NaN', 'Infinity', '-Infinity')
     or v_total::text in ('NaN', 'Infinity', '-Infinity')
     or abs(v_tax) > 9007199254740991 or abs(v_total) > 9007199254740991 then
    return jsonb_build_object('outcome', 'invalid-money');
  end if;

  -- Match the canonical config read: zero rows defaults; multiple rows is
  -- ambiguous, not permission to choose one or guess a sequence number.
  v_count := 0;
  for v_item in select * from public.document_sequences
    where dealer_id = p_dealer_id and sequence_type = 'invoice'
    order by id for update
  loop
    v_count := v_count + 1;
    v_seq := v_item;
  end loop;
  if v_count > 1 then return jsonb_build_object('outcome', 'numbering-conflict'); end if;
  if v_count = 1 then
    v_prefix := v_seq.prefix; v_padding := v_seq.padding; v_reset := v_seq.reset_policy;
  end if;
  if v_reset = 'yearly' then
    v_period := extract(year from current_timestamp at time zone 'Asia/Tokyo')::integer;
  elsif v_reset = 'monthly' then
    v_period := to_char(current_timestamp at time zone 'Asia/Tokyo', 'YYYYMM')::integer;
  end if;
  -- Authoritative existing allocator participates in THIS transaction. Any
  -- exception after this point must propagate so numbering/header/items roll back.
  v_next := public.get_next_document_number(p_dealer_id, 'invoice', v_period,
    v_prefix, v_padding, v_reset);
  if v_next is null or v_next <= 0 then raise exception 'invoice_number_allocation_failed'; end if;
  v_number := concat_ws('-', nullif(v_prefix, ''),
    case when v_period >= 100000 then substr(v_period::text, 1, 4) || '-' || substr(v_period::text, 5, 2)
         when v_period > 0 then v_period::text else null end,
    lpad(v_next::text, greatest(v_padding, length(v_next::text)), '0'));
  insert into public.invoices(dealer_id, customer_id, vehicle_id, estimate_id,
    invoice_number, status, title, issue_date, due_date, delivery_date,
    discount_amount, tax_rate, paid_amount, subtotal, tax_amount, total, balance_due)
  values(p_dealer_id, v_est.customer_id, v_est.vehicle_id, p_estimate_id,
    v_number, 'draft', coalesce(v_est.title, '請求書'), p_issue_date, p_due_date, null,
    coalesce(v_est.discount_amount, 0), coalesce(v_est.tax_rate, 10), 0,
    v_subtotal::text::numeric, v_tax::text::numeric, v_total::text::numeric, v_total::text::numeric)
  returning id into v_id;
  insert into public.invoice_items(invoice_id, dealer_id, category, item_name,
    description, quantity, unit_price, discount_rate, line_total, sort_order)
  select v_id, p_dealer_id, x.category, x.item_name, x.description, x.quantity,
    x.unit_price, x.discount_rate, x.line_total, x.sort_order
  from jsonb_to_recordset(v_items) as x(category text, item_name text, description text,
    quantity numeric, unit_price numeric, discount_rate numeric, line_total numeric, sort_order integer);
  return jsonb_build_object('outcome', 'created', 'id', v_id,
    'customer_id', v_est.customer_id, 'estimate_number', v_est.estimate_number);
end;
$$;
revoke all on function public.create_invoice_from_estimate_atomic(uuid, uuid, date, date)
  from public, anon, service_role;
grant execute on function public.create_invoice_from_estimate_atomic(uuid, uuid, date, date)
  to authenticated;
