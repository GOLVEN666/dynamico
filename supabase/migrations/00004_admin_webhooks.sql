-- ============================================================
-- Dynamico — 00004 Platform admin + webhook order ingestion
-- ============================================================

create extension if not exists pgcrypto; -- gen_random_bytes for tokens

-- ---------- Platform super admin ----------
alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select is_super_admin from profiles where id = auth.uid()),
    false
  );
$$;

-- Super admins get READ access everywhere: is_member() backs every
-- select policy, so widening it here grants platform-wide visibility.
-- Writes still go through has_role(), which stays membership-strict.
create or replace function public.is_member(p_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid()
  ) or public.is_super_admin();
$$;

-- Super admins can also see every profile (for the admin console).
drop policy "profiles: read own or teammates" on public.profiles;
create policy "profiles: read own, teammates or super admin"
  on public.profiles for select
  using (id = auth.uid() or public.shares_workspace(id) or public.is_super_admin());

-- ---------- Webhook endpoints ----------
-- One row per connected sales channel. The token authenticates
-- incoming webhooks (Shopify/WooCommerce can't set custom headers).
create table public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  source text not null check (source in ('shopify', 'woocommerce', 'custom')),
  -- stock for incoming orders is deducted from this warehouse
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  is_active boolean not null default true,
  last_received_at timestamptz,
  created_at timestamptz not null default now()
);

create index webhook_endpoints_workspace_idx on public.webhook_endpoints (workspace_id);

-- ---------- External orders ----------
-- Every webhook delivery lands here (idempotent on source + external id),
-- then fans out into stock_movements per matched SKU.
create table public.external_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  endpoint_id uuid references public.webhook_endpoints (id) on delete set null,
  source text not null,
  external_id text not null,
  order_number text not null,
  status text not null default 'processed' check (status in ('processed', 'partial', 'failed', 'duplicate')),
  items_total integer not null default 0,
  items_matched integer not null default 0,
  error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, source, external_id)
);

create index external_orders_workspace_idx on public.external_orders (workspace_id, created_at desc);

-- ---------- RLS ----------
alter table public.webhook_endpoints enable row level security;
alter table public.external_orders enable row level security;

create policy "webhook_endpoints: members read" on public.webhook_endpoints for select
  using (public.is_member(workspace_id));
create policy "webhook_endpoints: owner/admin insert" on public.webhook_endpoints for insert
  with check (public.has_role(workspace_id, array['owner', 'admin']::member_role[]));
create policy "webhook_endpoints: owner/admin update" on public.webhook_endpoints for update
  using (public.has_role(workspace_id, array['owner', 'admin']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin']::member_role[]));
create policy "webhook_endpoints: owner/admin delete" on public.webhook_endpoints for delete
  using (public.has_role(workspace_id, array['owner', 'admin']::member_role[]));

-- orders are system-written (ingest_order, security definer); members read.
create policy "external_orders: members read" on public.external_orders for select
  using (public.is_member(workspace_id));

-- ---------- Order ingestion ----------
-- Token-authenticated entry point, callable by anon (PostgREST RPC) or
-- the order-webhook edge function. Accepts Shopify/WooCommerce payloads
-- (line_items[].sku/quantity) and a generic shape (items[].sku/qty).
-- Lines are matched by SKU; failures (unknown SKU, insufficient stock)
-- degrade the order to 'partial'/'failed' instead of rejecting the webhook.
create or replace function public.ingest_order(p_token text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_endpoint public.webhook_endpoints;
  v_items jsonb;
  v_item jsonb;
  v_sku text;
  v_qty integer;
  v_product_id uuid;
  v_order_id uuid;
  v_external_id text;
  v_order_number text;
  v_total integer := 0;
  v_matched integer := 0;
  v_errors text[] := '{}';
  v_status text;
begin
  select * into v_endpoint
  from webhook_endpoints
  where token = p_token and is_active;
  if not found then
    raise exception 'Invalid or inactive webhook token';
  end if;

  v_items := coalesce(p_payload -> 'line_items', p_payload -> 'items', '[]'::jsonb);
  if jsonb_typeof(v_items) <> 'array' then
    raise exception 'Payload must contain a line_items or items array';
  end if;

  v_external_id := coalesce(
    p_payload ->> 'id', p_payload ->> 'order_id', p_payload ->> 'external_id',
    md5(p_payload::text)
  );
  v_order_number := coalesce(
    p_payload ->> 'order_number', p_payload ->> 'number', p_payload ->> 'name',
    v_external_id
  );

  -- idempotency: webhook retries must not double-deduct stock
  if exists (
    select 1 from external_orders
    where workspace_id = v_endpoint.workspace_id
      and source = v_endpoint.source
      and external_id = v_external_id
  ) then
    return jsonb_build_object('status', 'duplicate', 'order', v_order_number);
  end if;

  insert into external_orders (workspace_id, endpoint_id, source, external_id, order_number, payload)
  values (v_endpoint.workspace_id, v_endpoint.id, v_endpoint.source, v_external_id, v_order_number, p_payload)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(v_items)
  loop
    v_total := v_total + 1;
    v_sku := coalesce(v_item ->> 'sku', v_item ->> 'SKU');
    v_qty := coalesce(
      nullif(v_item ->> 'quantity', '')::integer,
      nullif(v_item ->> 'qty', '')::integer,
      1
    );

    if v_sku is null or v_sku = '' then
      v_errors := array_append(v_errors, format('line %s: missing SKU', v_total));
      continue;
    end if;
    if v_qty <= 0 then
      v_errors := array_append(v_errors, format('line %s (%s): invalid quantity', v_total, v_sku));
      continue;
    end if;

    select id into v_product_id
    from products
    where workspace_id = v_endpoint.workspace_id and sku = v_sku;
    if v_product_id is null then
      v_errors := array_append(v_errors, format('SKU "%s" not found', v_sku));
      continue;
    end if;

    begin
      insert into stock_movements (workspace_id, product_id, warehouse_id, type, quantity, reference, notes)
      values (
        v_endpoint.workspace_id, v_product_id, v_endpoint.warehouse_id,
        'out', v_qty,
        'Order ' || v_order_number,
        format('Auto-ingested from %s (%s)', v_endpoint.source, v_endpoint.name)
      );
      v_matched := v_matched + 1;
    exception when others then
      -- e.g. insufficient stock: flag the line, keep the rest of the order
      v_errors := array_append(v_errors, format('SKU "%s": %s', v_sku, sqlerrm));
    end;
  end loop;

  v_status := case
    when v_total = 0 or v_matched = 0 then 'failed'
    when v_matched < v_total or coalesce(array_length(v_errors, 1), 0) > 0 then 'partial'
    else 'processed'
  end;

  update external_orders
  set status = v_status,
      items_total = v_total,
      items_matched = v_matched,
      error = nullif(array_to_string(v_errors, '; '), '')
  where id = v_order_id;

  update webhook_endpoints set last_received_at = now() where id = v_endpoint.id;

  return jsonb_build_object(
    'status', v_status,
    'order', v_order_number,
    'matched', v_matched,
    'total', v_total,
    'errors', to_jsonb(v_errors)
  );
end;
$$;

revoke all on function public.ingest_order(text, jsonb) from public;
grant execute on function public.ingest_order(text, jsonb) to anon, authenticated, service_role;

-- ---------- Bootstrap a platform admin ----------
-- Run after the user has signed up (or use scripts/post-setup.mjs):
-- update public.profiles set is_super_admin = true where lower(email) = 'test@tester.com';
