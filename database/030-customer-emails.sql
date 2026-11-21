-- Pool Shed 030 - customer emails from fulfilment (owner request 21 Nov 2026): when an order is picked, packed,
-- shipped or collected, staff choose with a tick box whether to email the customer; the email goes only to the email
-- address on the order's customer record, with the courier and tracking number.
-- Switch 'customer_emails' starts OFF (customer emails need the owner's go-ahead). Every send is logged.
-- Staff who can send: any active user except Engineer. The server calls these with the person's own sign-in.
-- Requires 015 and 019. Additive.
begin;

insert into public.ps_feature_flags(name, enabled, note)
values ('customer_emails', false, 'Email customers when orders are picked, packed, shipped or collected. OFF until the owner approves.')
on conflict (name) do nothing;

create table if not exists public.ps_customer_email_log (
  id bigserial primary key,
  workspace_id text not null,
  order_id text not null,
  goods_note_id text,
  trigger text not null,
  sent_to text not null,
  subject text not null,
  sent_by uuid,
  sent_at timestamptz not null default now(),
  provider_id text
);
create index if not exists ps_customer_email_log_order on public.ps_customer_email_log(workspace_id, order_id, sent_at desc);
alter table public.ps_customer_email_log enable row level security;
revoke all on public.ps_customer_email_log from anon, authenticated;

-- Who may send, and what to send: the order's customer email (never one typed in), the rule wording, the company.
create or replace function public.ps_customer_email_context(w text, order_id text, trig text)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare acc jsonb; o jsonb; c jsonb; rule jsonb; company jsonb; email text;
begin
  if not ps_workspace_can_read(w) then raise exception 'Access denied'; end if;
  acc := ps_user_access();
  if coalesce(acc->>'role', '') in ('', 'Engineer') then raise exception 'Customer emails are sent by office and warehouse staff'; end if;
  if trig not in ('Pick', 'Pack', 'Ship', 'Collection', 'Part Ship') then raise exception 'That step does not email customers'; end if;
  select data into o from ps_records where workspace_id = w and section = 'salesOrders' and deleted_at is null and key = 'id:' || order_id;
  if o is null then raise exception 'Order % not found (save it first)', order_id; end if;
  select data into c from ps_records where workspace_id = w and section = 'customers' and deleted_at is null and key = 'id:' || (o->>'customerId');
  email := nullif(trim(coalesce(c->>'email', '')), '');
  select data into rule from ps_records where workspace_id = w and section = 'customerNotificationRules' and deleted_at is null
     and data->>'trigger' = case when trig = 'Part Ship' then 'Ship' when trig = 'Collection' then 'Ship' else trig end limit 1;
  select data->'companySettings' into company from workspace_snapshots where workspace_id = w;
  return jsonb_build_object('order_id', order_id, 'trigger', trig,
    'customer', jsonb_build_object('name', coalesce(nullif(trim(c->>'companyName'), ''), nullif(trim(c->>'name'), ''), trim(concat_ws(' ', c->>'firstName', c->>'lastName'))), 'email', email),
    'rule', jsonb_build_object('subject', rule->>'subjectTemplate', 'body', rule->>'bodyTemplate', 'enabled', coalesce((rule->>'enabled')::boolean, false)),
    'company', jsonb_build_object('name', company->>'name', 'email', company->>'email', 'phone', company->>'phone'),
    'sent_before', (select count(*) from ps_customer_email_log l where l.workspace_id = w and l.order_id = o->>'id' and l.trigger = trig),
    'emails_on', coalesce((select enabled from ps_feature_flags where name = 'customer_emails'), false));
end $$;
revoke all on function public.ps_customer_email_context(text,text,text) from public, anon;
grant execute on function public.ps_customer_email_context(text,text,text) to authenticated;

create or replace function public.ps_customer_email_sent(w text, order_id text, goods_note_id text, trig text, sent_to text, subject text, provider_id text default null)
returns void language plpgsql security definer set search_path=public as $$
declare acc jsonb;
begin
  if not ps_workspace_can_read(w) then raise exception 'Access denied'; end if;
  acc := ps_user_access();
  if coalesce(acc->>'role', '') in ('', 'Engineer') then raise exception 'Customer emails are sent by office and warehouse staff'; end if;
  insert into ps_customer_email_log(workspace_id, order_id, goods_note_id, trigger, sent_to, subject, sent_by, provider_id)
  values (w, order_id, nullif(goods_note_id, ''), trig, left(sent_to, 300), left(subject, 300), auth.uid(), provider_id);
end $$;
revoke all on function public.ps_customer_email_sent(text,text,text,text,text,text,text) from public, anon;
grant execute on function public.ps_customer_email_sent(text,text,text,text,text,text,text) to authenticated;

commit;
