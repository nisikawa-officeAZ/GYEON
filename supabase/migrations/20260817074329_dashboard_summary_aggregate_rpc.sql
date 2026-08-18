-- PERF-B: collapse the dealer dashboard read fan-out into one RLS-bound RPC.
--
-- This function deliberately remains SECURITY INVOKER. Every underlying table
-- keeps enforcing its existing RLS policy for the authenticated caller. The
-- explicit active-membership check is an additional fail-closed gate and does
-- not replace table RLS.

create or replace function public.get_dashboard_summary(p_dealer_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_summary jsonb;
begin
  if (select auth.uid()) is null or not exists (
    select 1
    from public.dealer_members dm
    where dm.user_id = (select auth.uid())
      and dm.dealer_id = p_dealer_id
      and dm.status = 'active'
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'customer_count', (
      select count(*) from public.customers c where c.dealer_id = p_dealer_id
    ),
    'vehicle_count', (
      select count(*) from public.vehicles v where v.dealer_id = p_dealer_id
    ),
    'estimates', (
      select jsonb_build_object(
        'draft', count(*) filter (where lower(e.status) = 'draft'),
        'proposal', count(*) filter (where lower(e.status) in ('proposal', 'sent')),
        'approved', count(*) filter (where lower(e.status) = 'approved'),
        'rejected', count(*) filter (where lower(e.status) in ('rejected', 'lost')),
        'expired', count(*) filter (where lower(e.status) = 'expired')
      )
      from public.estimates e
      where e.dealer_id = p_dealer_id
    ),
    'work_orders', (
      select jsonb_build_object(
        'scheduled', count(*) filter (where lower(w.status) = 'scheduled'),
        'in_progress', count(*) filter (where lower(w.status) = 'in_progress'),
        'completed', count(*) filter (where lower(w.status) = 'completed'),
        'on_hold', count(*) filter (where lower(w.status) = 'on_hold'),
        'cancelled', count(*) filter (where lower(w.status) = 'cancelled')
      )
      from public.work_orders w
      where w.dealer_id = p_dealer_id
    ),
    'invoices', (
      select jsonb_build_object(
        'draft', count(*) filter (where lower(i.status) = 'draft'),
        'issued', count(*) filter (where lower(i.status) = 'issued'),
        'paid', count(*) filter (where lower(i.status) = 'paid'),
        'partially_paid', count(*) filter (where lower(i.status) = 'partially_paid'),
        'overdue', count(*) filter (where lower(i.status) = 'overdue'),
        'cancelled', count(*) filter (where lower(i.status) = 'cancelled')
      )
      from public.invoices i
      where i.dealer_id = p_dealer_id
        and i.deleted_at is null
    ),
    'sales', jsonb_build_object(
      'monthly_sales', coalesce((
        select sum(i.total)
        from public.invoices i
        where i.dealer_id = p_dealer_id
          and i.deleted_at is null
          and i.status = 'paid'
          and i.issue_date >= date_trunc('month', current_date)::date
      ), 0),
      'monthly_received', coalesce((
        select sum(p.amount)
        from public.payments p
        where p.dealer_id = p_dealer_id
          and p.status = 'completed'
          and p.payment_date >= date_trunc('month', current_date)::date
      ), 0),
      'outstanding', coalesce((
        select sum(i.balance_due)
        from public.invoices i
        where i.dealer_id = p_dealer_id
          and i.deleted_at is null
          and i.status <> 'cancelled'
          and i.balance_due > 0
      ), 0),
      'yearly_sales', coalesce((
        select sum(i.total)
        from public.invoices i
        where i.dealer_id = p_dealer_id
          and i.deleted_at is null
          and i.status = 'paid'
          and i.issue_date >= date_trunc('year', current_date)::date
      ), 0)
    ),
    'line_stats', (
      select jsonb_build_object(
        'friends_count', count(*) filter (where lc.is_friend is true),
        'linked_count', count(*) filter (where lc.is_friend is true and lc.customer_id is not null),
        'this_month_new', count(*) filter (
          where lc.is_friend is true
            and lc.created_at >= date_trunc('month', current_date)
        )
      )
      from public.line_customers lc
      where lc.dealer_id = p_dealer_id
    ),
    'line_message_stats', (
      select jsonb_build_object(
        'this_month_sent', count(*) filter (
          where lml.status = 'sent'
            and lml.sent_at >= date_trunc('month', current_date)
        ),
        'this_month_failed', count(*) filter (
          where lml.status = 'failed'
            and lml.failed_at >= date_trunc('month', current_date)
        ),
        'total_sent', count(*) filter (where lml.status = 'sent')
      )
      from public.line_message_logs lml
      where lml.dealer_id = p_dealer_id
    ),
    'line_queue_stats', (
      select jsonb_build_object(
        'scheduled', count(*) filter (where lnq.status = 'scheduled'),
        'failed', count(*) filter (where lnq.status = 'failed')
      )
      from public.line_notification_queue lnq
      where lnq.dealer_id = p_dealer_id
    ),
    'maintenance_stats', (
      select jsonb_build_object(
        'this_month', count(*) filter (
          where mr.due_date >= date_trunc('month', current_date)::date
            and mr.due_date < (date_trunc('month', current_date) + interval '1 month')::date
        ),
        'next_7_days', count(*) filter (
          where mr.scheduled_send_at >= current_timestamp
            and mr.scheduled_send_at <= current_timestamp + interval '7 days'
            and mr.status in ('scheduled', 'queued')
        ),
        'pending', count(*) filter (where mr.status in ('scheduled', 'queued')),
        'sent_this_month', count(*) filter (
          where mr.status = 'sent'
            and mr.sent_at >= date_trunc('month', current_date)
        )
      )
      from public.maintenance_reminders mr
      where mr.dealer_id = p_dealer_id
    ),
    'reservation_stats', (
      select jsonb_build_object(
        'today', count(*) filter (where r.reservation_date = current_date),
        'this_week', count(*) filter (
          where r.reservation_date >= current_date
            and r.reservation_date <= current_date + 7
        ),
        'this_month', count(*) filter (
          where r.reservation_date >= date_trunc('month', current_date)::date
        ),
        'pending', count(*) filter (where r.status = 'pending'),
        'confirmed', count(*) filter (where r.status = 'confirmed')
      )
      from public.reservations r
      where r.dealer_id = p_dealer_id
    ),
    'today_work_orders', (
      select coalesce(jsonb_agg(rows.item order by rows.scheduled_start_at), '[]'::jsonb)
      from (
        select
          w.scheduled_start_at,
          jsonb_build_object(
            'id', w.id,
            'work_order_number', w.work_order_number,
            'title', w.title,
            'status', w.status,
            'assigned_staff', w.assigned_staff,
            'scheduled_start_at', w.scheduled_start_at,
            'scheduled_end_at', w.scheduled_end_at,
            'customers', case when c.id is null then 'null'::jsonb else jsonb_build_object(
              'last_name', c.last_name,
              'first_name', c.first_name
            ) end,
            'vehicles', case when v.id is null then 'null'::jsonb else jsonb_build_object(
              'maker', v.maker,
              'model', v.model,
              'plate_number', v.plate_number
            ) end
          ) as item
        from public.work_orders w
        left join public.customers c on c.id = w.customer_id and c.dealer_id = p_dealer_id
        left join public.vehicles v on v.id = w.vehicle_id and v.dealer_id = p_dealer_id
        where w.dealer_id = p_dealer_id
          and w.scheduled_start_at >= current_date::timestamptz
          and w.scheduled_start_at < (current_date + 1)::timestamptz
      ) rows
    ),
    'upcoming_work_orders', (
      select coalesce(jsonb_agg(rows.item order by rows.scheduled_start_at), '[]'::jsonb)
      from (
        select
          w.scheduled_start_at,
          jsonb_build_object(
            'id', w.id,
            'work_order_number', w.work_order_number,
            'title', w.title,
            'status', w.status,
            'scheduled_start_at', w.scheduled_start_at,
            'customers', case when c.id is null then 'null'::jsonb else jsonb_build_object(
              'last_name', c.last_name,
              'first_name', c.first_name
            ) end,
            'vehicles', case when v.id is null then 'null'::jsonb else jsonb_build_object(
              'maker', v.maker,
              'model', v.model
            ) end
          ) as item
        from public.work_orders w
        left join public.customers c on c.id = w.customer_id and c.dealer_id = p_dealer_id
        left join public.vehicles v on v.id = w.vehicle_id and v.dealer_id = p_dealer_id
        where w.dealer_id = p_dealer_id
          and w.status in ('scheduled', 'in_progress')
          and w.scheduled_start_at >= (current_date + 1)::timestamptz
          and w.scheduled_start_at < (current_date + 8)::timestamptz
        order by w.scheduled_start_at
        limit 20
      ) rows
    ),
    'recent_activities', (
      select coalesce(jsonb_agg(rows.item order by rows.activity_date desc), '[]'::jsonb)
      from (
        select activity.activity_date, activity.item
        from (
          (
            select
              e.created_at as activity_date,
              jsonb_build_object(
                'id', e.id,
                'type', 'estimate',
                'label', coalesce(nullif(concat_ws(' ', c.last_name, c.first_name), ''), '—'),
                'sub_label', '見積 ' || coalesce(e.estimate_number, left(e.id::text, 6)),
                'date', e.created_at,
                'status', e.status
              ) as item
            from public.estimates e
            left join public.customers c on c.id = e.customer_id and c.dealer_id = p_dealer_id
            where e.dealer_id = p_dealer_id
            order by e.created_at desc
            limit 5
          )
          union all
          (
            select
              coalesce(w.actual_end_at, w.updated_at) as activity_date,
              jsonb_build_object(
                'id', w.id,
                'type', 'work_order',
                'label', coalesce(nullif(concat_ws(' ', c.last_name, c.first_name), ''), '—'),
                'sub_label', '施工完了 ' || coalesce(w.work_order_number, left(w.id::text, 6)),
                'date', coalesce(w.actual_end_at, w.updated_at),
                'status', w.status
              ) as item
            from public.work_orders w
            left join public.customers c on c.id = w.customer_id and c.dealer_id = p_dealer_id
            where w.dealer_id = p_dealer_id
              and w.status = 'completed'
            order by w.updated_at desc
            limit 5
          )
          union all
          (
            select
              i.created_at as activity_date,
              jsonb_build_object(
                'id', i.id,
                'type', 'invoice',
                'label', coalesce(nullif(concat_ws(' ', c.last_name, c.first_name), ''), '—'),
                'sub_label', '請求書 ' || coalesce(i.invoice_number, left(i.id::text, 6)),
                'date', i.created_at,
                'status', i.status
              ) as item
            from public.invoices i
            left join public.customers c on c.id = i.customer_id and c.dealer_id = p_dealer_id
            where i.dealer_id = p_dealer_id
              and i.deleted_at is null
            order by i.created_at desc
            limit 5
          )
          union all
          (
            select
              p.payment_date::timestamptz as activity_date,
              jsonb_build_object(
                'id', p.id,
                'type', 'payment',
                'label', coalesce(nullif(concat_ws(' ', c.last_name, c.first_name), ''), '—'),
                'sub_label', '入金 ¥' || trim(to_char(coalesce(p.amount, 0), 'FM999,999,999,999,990')),
                'date', p.payment_date,
                'status', p.status
              ) as item
            from public.payments p
            left join public.customers c on c.id = p.customer_id and c.dealer_id = p_dealer_id
            where p.dealer_id = p_dealer_id
              and p.payment_date is not null
            order by p.created_at desc
            limit 5
          )
        ) activity
        where activity.activity_date is not null
        order by activity.activity_date desc
        limit 10
      ) rows
    )
  ) into v_summary;

  return v_summary;
end;
$function$;

comment on function public.get_dashboard_summary(uuid) is
  'RLS-bound aggregate for the authenticated dealer dashboard; PERF-B.';

revoke all on function public.get_dashboard_summary(uuid) from public;
revoke all on function public.get_dashboard_summary(uuid) from anon;
grant execute on function public.get_dashboard_summary(uuid) to authenticated;
