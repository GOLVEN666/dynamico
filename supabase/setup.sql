-- ============================================================
-- Dynamico — complete database setup (IDEMPOTENT)
-- Generated from supabase/migrations/*.sql
-- Safe to run multiple times: existing objects are skipped or replaced.
-- ============================================================

-- ============================================================
-- 00001_schema.sql
-- ============================================================

-- ============================================================
-- Dynamico — 00001 Schema
-- Tables, enums, indexes, updated_at triggers, auth profile sync
-- ============================================================

-- ---------- Enums ----------
do $do$ begin
  create type member_role as enum ('owner', 'admin', 'member', 'viewer');
exception when duplicate_object then null;
end $do$;
do $do$ begin
  create type product_status as enum ('draft', 'active', 'archived');
exception when duplicate_object then null;
end $do$;
do $do$ begin
  create type movement_type as enum ('in', 'out', 'adjustment', 'transfer_in', 'transfer_out');
exception when duplicate_object then null;
end $do$;
do $do$ begin
  create type po_status as enum ('draft', 'ordered', 'received', 'cancelled');
exception when duplicate_object then null;
end $do$;
do $do$ begin
  create type alert_type as enum ('low_stock', 'out_of_stock');
exception when duplicate_object then null;
end $do$;
do $do$ begin
  create type alert_status as enum ('active', 'resolved', 'dismissed');
exception when duplicate_object then null;
end $do$;

-- ---------- updated_at helper ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- profiles ----------
-- Mirror of auth.users, kept in sync by trigger. Email stored for
-- member lookup ("invite by email" without an email service).
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_idx on public.profiles (lower(email));

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- workspaces ----------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}$'),
  logo_url text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists workspaces_updated_at on public.workspaces;
create trigger workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- ---------- workspace_members ----------
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role member_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on public.workspace_members (user_id);
create index if not exists workspace_members_workspace_idx on public.workspace_members (workspace_id);

-- ---------- settings (1 row per workspace) ----------
create table if not exists public.settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  currency text not null default 'USD',
  timezone text not null default 'UTC',
  low_stock_alerts_enabled boolean not null default true,
  out_of_stock_alerts_enabled boolean not null default true,
  po_counter integer not null default 0,
  updated_at timestamptz not null default now()
);

drop trigger if exists settings_updated_at on public.settings;
create trigger settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------- categories ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create index if not exists categories_workspace_idx on public.categories (workspace_id);

-- ---------- suppliers ----------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suppliers_workspace_idx on public.suppliers (workspace_id);

drop trigger if exists suppliers_updated_at on public.suppliers;
create trigger suppliers_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- ---------- warehouses ----------
create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  location text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists warehouses_workspace_idx on public.warehouses (workspace_id);

drop trigger if exists warehouses_updated_at on public.warehouses;
create trigger warehouses_updated_at
  before update on public.warehouses
  for each row execute function public.set_updated_at();

-- ---------- products ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  sku text not null check (char_length(sku) between 1 and 60),
  barcode text,
  description text,
  category_id uuid references public.categories (id) on delete set null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  cost_price numeric(12, 2) not null default 0 check (cost_price >= 0),
  selling_price numeric(12, 2) not null default 0 check (selling_price >= 0),
  minimum_stock integer not null default 0 check (minimum_stock >= 0),
  status product_status not null default 'active',
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, sku)
);

create index if not exists products_workspace_idx on public.products (workspace_id);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_supplier_idx on public.products (supplier_id);
create index if not exists products_name_idx on public.products (workspace_id, lower(name));

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------- product_images ----------
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_idx on public.product_images (product_id);
create index if not exists product_images_workspace_idx on public.product_images (workspace_id);

-- ---------- stock_levels ----------
-- Derived state. NEVER written by clients — only by the
-- apply_stock_movement trigger. No write RLS policies exist.
create table if not exists public.stock_levels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  -- non-negativity is enforced by apply_stock_movement() so callers
  -- get a descriptive "insufficient stock" error instead of a constraint violation
  quantity integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (product_id, warehouse_id)
);

create index if not exists stock_levels_workspace_idx on public.stock_levels (workspace_id);
create index if not exists stock_levels_warehouse_idx on public.stock_levels (warehouse_id);

-- ---------- stock_movements ----------
-- Immutable ledger. Inserts only; no update/delete policies.
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  type movement_type not null,
  -- Positive for in/out/transfers; signed delta for adjustments.
  quantity integer not null check (quantity <> 0),
  reference text,
  notes text,
  transfer_group uuid, -- links the two legs of a transfer
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  check (type = 'adjustment' or quantity > 0)
);

create index if not exists stock_movements_workspace_created_idx
  on public.stock_movements (workspace_id, created_at desc);
create index if not exists stock_movements_product_idx on public.stock_movements (product_id);
create index if not exists stock_movements_warehouse_idx on public.stock_movements (warehouse_id);

-- ---------- purchase_orders ----------
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  po_number text not null,
  status po_status not null default 'draft',
  notes text,
  expected_date date,
  ordered_at timestamptz,
  received_at timestamptz,
  created_by uuid references public.profiles (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, po_number)
);

create index if not exists purchase_orders_workspace_idx on public.purchase_orders (workspace_id, created_at desc);
create index if not exists purchase_orders_supplier_idx on public.purchase_orders (supplier_id);

drop trigger if exists purchase_orders_updated_at on public.purchase_orders;
create trigger purchase_orders_updated_at
  before update on public.purchase_orders
  for each row execute function public.set_updated_at();

-- ---------- purchase_order_items ----------
create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12, 2) not null default 0 check (unit_cost >= 0),
  received_quantity integer not null default 0 check (received_quantity >= 0)
);

create index if not exists po_items_po_idx on public.purchase_order_items (purchase_order_id);
create index if not exists po_items_workspace_idx on public.purchase_order_items (workspace_id);

-- ---------- alerts ----------
-- Created/resolved automatically by the stock movement trigger.
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  type alert_type not null,
  status alert_status not null default 'active',
  message text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists alerts_workspace_idx on public.alerts (workspace_id, status, created_at desc);
-- At most one ACTIVE alert per product/warehouse/type
create unique index if not exists alerts_active_unique
  on public.alerts (product_id, warehouse_id, type)
  where status = 'active';

-- ---------- activity_logs ----------
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,        -- e.g. 'products.created'
  entity_type text not null,   -- e.g. 'products'
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_workspace_idx on public.activity_logs (workspace_id, created_at desc);

-- ---------- storage bucket for product images ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;


-- ============================================================
-- 00002_logic.sql
-- ============================================================

-- ============================================================
-- Dynamico — 00002 Business logic
-- Membership helpers, stock ledger trigger, alert engine,
-- transfers, purchase order receiving, activity logging, analytics
-- ============================================================

-- ---------- Membership helpers ----------
-- SECURITY DEFINER so RLS policies can consult workspace_members
-- without infinite recursion.
create or replace function public.is_member(p_workspace_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id and user_id = auth.uid()
  );
$$;

create or replace function public.has_role(p_workspace_id uuid, p_roles member_role[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from workspace_members
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role = any (p_roles)
  );
$$;

-- True when the target profile shares at least one workspace with the caller.
create or replace function public.shares_workspace(p_profile_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from workspace_members me
    join workspace_members them on them.workspace_id = me.workspace_id
    where me.user_id = auth.uid() and them.user_id = p_profile_id
  );
$$;

-- ---------- Workspace creation (atomic) ----------
-- Creates workspace + owner membership + settings in one call,
-- avoiding RLS chicken-and-egg problems on first insert.
create or replace function public.create_workspace(p_name text, p_slug text)
returns public.workspaces
language plpgsql security definer set search_path = public
as $$
declare
  v_ws public.workspaces;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into workspaces (name, slug, created_by)
  values (p_name, p_slug, auth.uid())
  returning * into v_ws;

  insert into workspace_members (workspace_id, user_id, role)
  values (v_ws.id, auth.uid(), 'owner');

  insert into settings (workspace_id) values (v_ws.id);

  insert into activity_logs (workspace_id, user_id, action, entity_type, entity_id, details)
  values (v_ws.id, auth.uid(), 'workspaces.created', 'workspaces', v_ws.id,
          jsonb_build_object('name', v_ws.name));

  return v_ws;
end;
$$;

-- ---------- Team: add member by email ----------
create or replace function public.add_member_by_email(
  p_workspace_id uuid,
  p_email text,
  p_role member_role default 'member'
)
returns public.workspace_members
language plpgsql security definer set search_path = public
as $$
declare
  v_profile_id uuid;
  v_member public.workspace_members;
begin
  if not has_role(p_workspace_id, array['owner', 'admin']::member_role[]) then
    raise exception 'Only owners and admins can add members';
  end if;
  if p_role = 'owner' then
    raise exception 'The owner role cannot be assigned';
  end if;

  select id into v_profile_id from profiles where lower(email) = lower(p_email);
  if v_profile_id is null then
    raise exception 'No Dynamico account exists for %. Ask them to sign up first.', p_email;
  end if;
  if exists (select 1 from workspace_members
             where workspace_id = p_workspace_id and user_id = v_profile_id) then
    raise exception '% is already a member of this workspace', p_email;
  end if;

  insert into workspace_members (workspace_id, user_id, role)
  values (p_workspace_id, v_profile_id, p_role)
  returning * into v_member;

  return v_member;
end;
$$;

-- ---------- Stock ledger: apply movements to stock_levels ----------
-- The single source of stock mutation. Applies the delta, rejects
-- negative results, and maintains low-stock / out-of-stock alerts.
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_delta integer;
  v_new_qty integer;
  v_min integer;
  v_product_name text;
  v_warehouse_name text;
  v_low_on boolean;
  v_out_on boolean;
begin
  v_delta := case new.type
    when 'in' then new.quantity
    when 'transfer_in' then new.quantity
    when 'out' then -new.quantity
    when 'transfer_out' then -new.quantity
    when 'adjustment' then new.quantity -- signed delta
  end;

  insert into stock_levels as sl (workspace_id, product_id, warehouse_id, quantity)
  values (new.workspace_id, new.product_id, new.warehouse_id, v_delta)
  on conflict (product_id, warehouse_id)
  do update set quantity = sl.quantity + excluded.quantity, updated_at = now()
  returning sl.quantity into v_new_qty;

  select name, minimum_stock into v_product_name, v_min
  from products where id = new.product_id;
  select name into v_warehouse_name from warehouses where id = new.warehouse_id;

  if v_new_qty < 0 then
    raise exception 'Insufficient stock for "%" in %: this movement would result in % units',
      v_product_name, v_warehouse_name, v_new_qty;
  end if;

  select low_stock_alerts_enabled, out_of_stock_alerts_enabled
  into v_low_on, v_out_on
  from settings where workspace_id = new.workspace_id;

  if v_new_qty = 0 then
    -- escalate: low_stock -> out_of_stock
    update alerts set status = 'resolved', resolved_at = now()
    where product_id = new.product_id and warehouse_id = new.warehouse_id
      and type = 'low_stock' and status = 'active';

    if coalesce(v_out_on, true) then
      insert into alerts (workspace_id, product_id, warehouse_id, type, message)
      values (new.workspace_id, new.product_id, new.warehouse_id, 'out_of_stock',
              format('"%s" is out of stock in %s', v_product_name, v_warehouse_name))
      on conflict (product_id, warehouse_id, type) where status = 'active' do nothing;
    end if;

  elsif v_min > 0 and v_new_qty <= v_min then
    update alerts set status = 'resolved', resolved_at = now()
    where product_id = new.product_id and warehouse_id = new.warehouse_id
      and type = 'out_of_stock' and status = 'active';

    if coalesce(v_low_on, true) then
      insert into alerts (workspace_id, product_id, warehouse_id, type, message)
      values (new.workspace_id, new.product_id, new.warehouse_id, 'low_stock',
              format('"%s" is low in %s: %s left (minimum %s)',
                     v_product_name, v_warehouse_name, v_new_qty, v_min))
      on conflict (product_id, warehouse_id, type) where status = 'active' do nothing;
    end if;

  else
    -- healthy again: resolve anything active
    update alerts set status = 'resolved', resolved_at = now()
    where product_id = new.product_id and warehouse_id = new.warehouse_id
      and status = 'active';
  end if;

  return new;
end;
$$;

drop trigger if exists stock_movements_apply on public.stock_movements;
create trigger stock_movements_apply
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

-- ---------- Transfers (atomic two-leg movement) ----------
-- SECURITY INVOKER: RLS still validates the caller can write movements.
create or replace function public.transfer_stock(
  p_product_id uuid,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_quantity integer,
  p_notes text default null
)
returns uuid
language plpgsql set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_group uuid := gen_random_uuid();
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Transfer quantity must be greater than zero';
  end if;
  if p_from_warehouse_id = p_to_warehouse_id then
    raise exception 'Source and destination warehouses must be different';
  end if;

  select workspace_id into v_workspace_id from products where id = p_product_id;
  if v_workspace_id is null then
    raise exception 'Product not found';
  end if;
  if not exists (select 1 from warehouses
                 where id = p_from_warehouse_id and workspace_id = v_workspace_id)
     or not exists (select 1 from warehouses
                    where id = p_to_warehouse_id and workspace_id = v_workspace_id) then
    raise exception 'Both warehouses must belong to the product''s workspace';
  end if;

  insert into stock_movements (workspace_id, product_id, warehouse_id, type, quantity, notes, transfer_group)
  values (v_workspace_id, p_product_id, p_from_warehouse_id, 'transfer_out', p_quantity, p_notes, v_group);

  insert into stock_movements (workspace_id, product_id, warehouse_id, type, quantity, notes, transfer_group)
  values (v_workspace_id, p_product_id, p_to_warehouse_id, 'transfer_in', p_quantity, p_notes, v_group);

  return v_group;
end;
$$;

-- ---------- Purchase orders ----------
-- Race-safe per-workspace PO numbering via the settings counter.
create or replace function public.assign_po_number()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_counter integer;
begin
  if new.po_number is null or new.po_number = '' then
    update settings set po_counter = po_counter + 1
    where workspace_id = new.workspace_id
    returning po_counter into v_counter;

    if v_counter is null then
      raise exception 'Workspace settings row is missing';
    end if;
    new.po_number := 'PO-' || lpad(v_counter::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists purchase_orders_assign_number on public.purchase_orders;
create trigger purchase_orders_assign_number
  before insert on public.purchase_orders
  for each row execute function public.assign_po_number();

-- Receive an ordered PO: stock-in every outstanding line item, then close it.
-- SECURITY INVOKER so RLS verifies the caller's write access.
create or replace function public.receive_purchase_order(p_purchase_order_id uuid)
returns void
language plpgsql set search_path = public
as $$
declare
  v_po public.purchase_orders%rowtype;
  v_item record;
  v_remaining integer;
begin
  select * into v_po from purchase_orders
  where id = p_purchase_order_id
  for update;

  if not found then
    raise exception 'Purchase order not found';
  end if;
  if v_po.status <> 'ordered' then
    raise exception 'Only ordered purchase orders can be received (current status: %)', v_po.status;
  end if;

  for v_item in
    select * from purchase_order_items where purchase_order_id = v_po.id
  loop
    v_remaining := v_item.quantity - v_item.received_quantity;
    if v_remaining > 0 then
      insert into stock_movements (workspace_id, product_id, warehouse_id, type, quantity, reference)
      values (v_po.workspace_id, v_item.product_id, v_po.warehouse_id, 'in', v_remaining, v_po.po_number);

      update purchase_order_items
      set received_quantity = v_item.quantity
      where id = v_item.id;
    end if;
  end loop;

  update purchase_orders
  set status = 'received', received_at = now()
  where id = v_po.id;
end;
$$;

-- ---------- Activity logging (generic) ----------
create or replace function public.log_activity()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_new jsonb := coalesce(to_jsonb(new), '{}'::jsonb);
  v_old jsonb := coalesce(to_jsonb(old), '{}'::jsonb);
  v_verb text := case tg_op when 'INSERT' then 'created'
                            when 'UPDATE' then 'updated'
                            else 'deleted' end;
  v_product_name text;
begin
  -- movements have no name column; resolve the product name for the feed
  if tg_table_name = 'stock_movements' then
    select name into v_product_name
    from products where id = (v_new ->> 'product_id')::uuid;
  end if;

  insert into activity_logs (workspace_id, user_id, action, entity_type, entity_id, details)
  values (
    coalesce((v_new ->> 'workspace_id')::uuid, (v_old ->> 'workspace_id')::uuid),
    auth.uid(),
    tg_table_name || '.' || v_verb,
    tg_table_name,
    coalesce((v_new ->> 'id')::uuid, (v_old ->> 'id')::uuid),
    jsonb_strip_nulls(jsonb_build_object(
      'name', coalesce(v_new ->> 'name', v_old ->> 'name', v_product_name),
      'sku', coalesce(v_new ->> 'sku', v_old ->> 'sku'),
      'po_number', coalesce(v_new ->> 'po_number', v_old ->> 'po_number'),
      'status', v_new ->> 'status',
      'type', case when tg_table_name = 'stock_movements' then v_new ->> 'type' end,
      'quantity', case when tg_table_name = 'stock_movements' then v_new ->> 'quantity' end,
      'role', case when tg_table_name = 'workspace_members'
                   then coalesce(v_new ->> 'role', v_old ->> 'role') end,
      'member_user_id', case when tg_table_name = 'workspace_members'
                             then coalesce(v_new ->> 'user_id', v_old ->> 'user_id') end
    ))
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists products_log on public.products;
create trigger products_log after insert or update or delete on public.products
  for each row execute function public.log_activity();
drop trigger if exists suppliers_log on public.suppliers;
create trigger suppliers_log after insert or update or delete on public.suppliers
  for each row execute function public.log_activity();
drop trigger if exists warehouses_log on public.warehouses;
create trigger warehouses_log after insert or update or delete on public.warehouses
  for each row execute function public.log_activity();
drop trigger if exists categories_log on public.categories;
create trigger categories_log after insert or delete on public.categories
  for each row execute function public.log_activity();
drop trigger if exists purchase_orders_log on public.purchase_orders;
create trigger purchase_orders_log after insert or update or delete on public.purchase_orders
  for each row execute function public.log_activity();
drop trigger if exists stock_movements_log on public.stock_movements;
create trigger stock_movements_log after insert on public.stock_movements
  for each row execute function public.log_activity();
drop trigger if exists workspace_members_log on public.workspace_members;
create trigger workspace_members_log after insert or update or delete on public.workspace_members
  for each row execute function public.log_activity();

-- ---------- Analytics ----------
-- SECURITY INVOKER (default): RLS still gates every row read.
create or replace function public.get_dashboard_stats(p_workspace_id uuid)
returns json
language sql stable set search_path = public
as $$
  select json_build_object(
    'total_products', (
      select count(*) from products
      where workspace_id = p_workspace_id and status <> 'archived'),
    'total_units', coalesce((
      select sum(quantity) from stock_levels
      where workspace_id = p_workspace_id), 0),
    'stock_value', coalesce((
      select sum(sl.quantity * p.cost_price)
      from stock_levels sl join products p on p.id = sl.product_id
      where sl.workspace_id = p_workspace_id), 0),
    'retail_value', coalesce((
      select sum(sl.quantity * p.selling_price)
      from stock_levels sl join products p on p.id = sl.product_id
      where sl.workspace_id = p_workspace_id), 0),
    'low_stock_count', (
      select count(*) from alerts
      where workspace_id = p_workspace_id and status = 'active' and type = 'low_stock'),
    'out_of_stock_count', (
      select count(*) from alerts
      where workspace_id = p_workspace_id and status = 'active' and type = 'out_of_stock'),
    'open_purchase_orders', (
      select count(*) from purchase_orders
      where workspace_id = p_workspace_id and status in ('draft', 'ordered'))
  );
$$;

-- Daily in/out series for charts. Transfers are excluded: they move
-- stock between warehouses without changing the total.
create or replace function public.get_movement_series(p_workspace_id uuid, p_days integer default 30)
returns table (day date, stock_in bigint, stock_out bigint)
language sql stable set search_path = public
as $$
  select
    d::date as day,
    coalesce(sum(case
      when m.type = 'in' then m.quantity
      when m.type = 'adjustment' and m.quantity > 0 then m.quantity
    end), 0)::bigint as stock_in,
    coalesce(sum(case
      when m.type = 'out' then m.quantity
      when m.type = 'adjustment' and m.quantity < 0 then -m.quantity
    end), 0)::bigint as stock_out
  from generate_series(current_date - (p_days - 1), current_date, interval '1 day') d
  left join stock_movements m
    on m.workspace_id = p_workspace_id
   and m.created_at >= d
   and m.created_at < d + interval '1 day'
  group by 1
  order by 1;
$$;

create or replace function public.get_stock_by_category(p_workspace_id uuid)
returns table (category text, color text, units bigint, value numeric)
language sql stable set search_path = public
as $$
  select
    coalesce(c.name, 'Uncategorized') as category,
    coalesce(c.color, '#94a3b8') as color,
    sum(sl.quantity)::bigint as units,
    coalesce(sum(sl.quantity * p.cost_price), 0) as value
  from stock_levels sl
  join products p on p.id = sl.product_id
  left join categories c on c.id = p.category_id
  where sl.workspace_id = p_workspace_id
  group by 1, 2
  order by 3 desc;
$$;

create or replace function public.get_top_products(p_workspace_id uuid, p_limit integer default 5)
returns table (product_id uuid, name text, sku text, units bigint, value numeric)
language sql stable set search_path = public
as $$
  select
    p.id, p.name, p.sku,
    coalesce(sum(sl.quantity), 0)::bigint as units,
    coalesce(sum(sl.quantity * p.cost_price), 0) as value
  from products p
  left join stock_levels sl on sl.product_id = p.id
  where p.workspace_id = p_workspace_id and p.status <> 'archived'
  group by p.id
  order by units desc
  limit p_limit;
$$;


-- ============================================================
-- 00003_rls.sql
-- ============================================================

-- ============================================================
-- Dynamico — 00003 Row Level Security
-- Every table is workspace-scoped. Membership gates reads;
-- role gates writes (viewer = read-only, member+ = operate,
-- owner/admin = manage workspace, team and settings).
-- ============================================================

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.settings enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.warehouses enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.stock_levels enable row level security;
alter table public.stock_movements enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.alerts enable row level security;
alter table public.activity_logs enable row level security;

-- ---------- profiles ----------
drop policy if exists "profiles: read own or teammates" on public.profiles;
create policy "profiles: read own or teammates"
  on public.profiles for select
  using (id = auth.uid() or public.shares_workspace(id));

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------- workspaces ----------
drop policy if exists "workspaces: members read" on public.workspaces;
create policy "workspaces: members read"
  on public.workspaces for select
  using (public.is_member(id));

-- creation happens through create_workspace() (security definer);
-- no direct insert policy keeps slugs/memberships consistent.

drop policy if exists "workspaces: owner/admin update" on public.workspaces;
create policy "workspaces: owner/admin update"
  on public.workspaces for update
  using (public.has_role(id, array['owner', 'admin']::member_role[]))
  with check (public.has_role(id, array['owner', 'admin']::member_role[]));

drop policy if exists "workspaces: owner delete" on public.workspaces;
create policy "workspaces: owner delete"
  on public.workspaces for delete
  using (public.has_role(id, array['owner']::member_role[]));

-- ---------- workspace_members ----------
drop policy if exists "members: members read" on public.workspace_members;
create policy "members: members read"
  on public.workspace_members for select
  using (public.is_member(workspace_id));

-- inserts happen through create_workspace()/add_member_by_email()
-- (security definer) so role rules live in one place.

drop policy if exists "members: owner/admin change roles" on public.workspace_members;
create policy "members: owner/admin change roles"
  on public.workspace_members for update
  using (public.has_role(workspace_id, array['owner', 'admin']::member_role[])
         and role <> 'owner')
  with check (role <> 'owner');

drop policy if exists "members: owner/admin remove, or leave" on public.workspace_members;
create policy "members: owner/admin remove, or leave"
  on public.workspace_members for delete
  using (
    role <> 'owner'
    and (user_id = auth.uid()
         or public.has_role(workspace_id, array['owner', 'admin']::member_role[]))
  );

-- ---------- settings ----------
drop policy if exists "settings: members read" on public.settings;
create policy "settings: members read"
  on public.settings for select
  using (public.is_member(workspace_id));

drop policy if exists "settings: owner/admin update" on public.settings;
create policy "settings: owner/admin update"
  on public.settings for update
  using (public.has_role(workspace_id, array['owner', 'admin']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin']::member_role[]));

-- ---------- operational tables: viewer reads, member+ writes ----------
-- categories
drop policy if exists "categories: members read" on public.categories;
create policy "categories: members read" on public.categories for select
  using (public.is_member(workspace_id));
drop policy if exists "categories: member+ insert" on public.categories;
create policy "categories: member+ insert" on public.categories for insert
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
drop policy if exists "categories: member+ update" on public.categories;
create policy "categories: member+ update" on public.categories for update
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
drop policy if exists "categories: member+ delete" on public.categories;
create policy "categories: member+ delete" on public.categories for delete
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- suppliers
drop policy if exists "suppliers: members read" on public.suppliers;
create policy "suppliers: members read" on public.suppliers for select
  using (public.is_member(workspace_id));
drop policy if exists "suppliers: member+ insert" on public.suppliers;
create policy "suppliers: member+ insert" on public.suppliers for insert
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
drop policy if exists "suppliers: member+ update" on public.suppliers;
create policy "suppliers: member+ update" on public.suppliers for update
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
drop policy if exists "suppliers: member+ delete" on public.suppliers;
create policy "suppliers: member+ delete" on public.suppliers for delete
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- warehouses
drop policy if exists "warehouses: members read" on public.warehouses;
create policy "warehouses: members read" on public.warehouses for select
  using (public.is_member(workspace_id));
drop policy if exists "warehouses: member+ insert" on public.warehouses;
create policy "warehouses: member+ insert" on public.warehouses for insert
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
drop policy if exists "warehouses: member+ update" on public.warehouses;
create policy "warehouses: member+ update" on public.warehouses for update
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
drop policy if exists "warehouses: member+ delete" on public.warehouses;
create policy "warehouses: member+ delete" on public.warehouses for delete
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- products
drop policy if exists "products: members read" on public.products;
create policy "products: members read" on public.products for select
  using (public.is_member(workspace_id));
drop policy if exists "products: member+ insert" on public.products;
create policy "products: member+ insert" on public.products for insert
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
drop policy if exists "products: member+ update" on public.products;
create policy "products: member+ update" on public.products for update
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
drop policy if exists "products: member+ delete" on public.products;
create policy "products: member+ delete" on public.products for delete
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- product_images
drop policy if exists "product_images: members read" on public.product_images;
create policy "product_images: members read" on public.product_images for select
  using (public.is_member(workspace_id));
drop policy if exists "product_images: member+ insert" on public.product_images;
create policy "product_images: member+ insert" on public.product_images for insert
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
drop policy if exists "product_images: member+ update" on public.product_images;
create policy "product_images: member+ update" on public.product_images for update
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
drop policy if exists "product_images: member+ delete" on public.product_images;
create policy "product_images: member+ delete" on public.product_images for delete
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- stock_levels: READ ONLY for everyone. The apply_stock_movement
-- trigger (security definer) is the only writer.
drop policy if exists "stock_levels: members read" on public.stock_levels;
create policy "stock_levels: members read" on public.stock_levels for select
  using (public.is_member(workspace_id));

-- stock_movements: immutable ledger — insert only, no update/delete.
drop policy if exists "stock_movements: members read" on public.stock_movements;
create policy "stock_movements: members read" on public.stock_movements for select
  using (public.is_member(workspace_id));
drop policy if exists "stock_movements: member+ insert" on public.stock_movements;
create policy "stock_movements: member+ insert" on public.stock_movements for insert
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- purchase_orders
drop policy if exists "purchase_orders: members read" on public.purchase_orders;
create policy "purchase_orders: members read" on public.purchase_orders for select
  using (public.is_member(workspace_id));
drop policy if exists "purchase_orders: member+ insert" on public.purchase_orders;
create policy "purchase_orders: member+ insert" on public.purchase_orders for insert
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
drop policy if exists "purchase_orders: member+ update" on public.purchase_orders;
create policy "purchase_orders: member+ update" on public.purchase_orders for update
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
drop policy if exists "purchase_orders: member+ delete" on public.purchase_orders;
create policy "purchase_orders: member+ delete" on public.purchase_orders for delete
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- purchase_order_items
drop policy if exists "po_items: members read" on public.purchase_order_items;
create policy "po_items: members read" on public.purchase_order_items for select
  using (public.is_member(workspace_id));
drop policy if exists "po_items: member+ insert" on public.purchase_order_items;
create policy "po_items: member+ insert" on public.purchase_order_items for insert
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
drop policy if exists "po_items: member+ update" on public.purchase_order_items;
create policy "po_items: member+ update" on public.purchase_order_items for update
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
drop policy if exists "po_items: member+ delete" on public.purchase_order_items;
create policy "po_items: member+ delete" on public.purchase_order_items for delete
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- alerts: system-created; members may resolve/dismiss (update only).
drop policy if exists "alerts: members read" on public.alerts;
create policy "alerts: members read" on public.alerts for select
  using (public.is_member(workspace_id));
drop policy if exists "alerts: member+ update" on public.alerts;
create policy "alerts: member+ update" on public.alerts for update
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- activity_logs: append-only via triggers; members read.
drop policy if exists "activity_logs: members read" on public.activity_logs;
create policy "activity_logs: members read" on public.activity_logs for select
  using (public.is_member(workspace_id));

-- ---------- storage: product images ----------
-- Objects live under {workspace_id}/{filename}; the first path
-- segment gates access by membership.
drop policy if exists "product images: public read" on storage.objects;
create policy "product images: public read"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "product images: members upload" on storage.objects;
create policy "product images: members upload"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and public.is_member(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "product images: members delete" on storage.objects;
create policy "product images: members delete"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and public.is_member(((storage.foldername(name))[1])::uuid)
  );


-- ============================================================
-- 00004_admin_webhooks.sql
-- ============================================================

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
drop policy if exists "profiles: read own or teammates" on public.profiles;
drop policy if exists "profiles: read own, teammates or super admin" on public.profiles;
create policy "profiles: read own, teammates or super admin"
  on public.profiles for select
  using (id = auth.uid() or public.shares_workspace(id) or public.is_super_admin());

-- ---------- Webhook endpoints ----------
-- One row per connected sales channel. The token authenticates
-- incoming webhooks (Shopify/WooCommerce can't set custom headers).
create table if not exists public.webhook_endpoints (
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

create index if not exists webhook_endpoints_workspace_idx on public.webhook_endpoints (workspace_id);

-- ---------- External orders ----------
-- Every webhook delivery lands here (idempotent on source + external id),
-- then fans out into stock_movements per matched SKU.
create table if not exists public.external_orders (
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

create index if not exists external_orders_workspace_idx on public.external_orders (workspace_id, created_at desc);

-- ---------- RLS ----------
alter table public.webhook_endpoints enable row level security;
alter table public.external_orders enable row level security;

drop policy if exists "webhook_endpoints: members read" on public.webhook_endpoints;
create policy "webhook_endpoints: members read" on public.webhook_endpoints for select
  using (public.is_member(workspace_id));
drop policy if exists "webhook_endpoints: owner/admin insert" on public.webhook_endpoints;
create policy "webhook_endpoints: owner/admin insert" on public.webhook_endpoints for insert
  with check (public.has_role(workspace_id, array['owner', 'admin']::member_role[]));
drop policy if exists "webhook_endpoints: owner/admin update" on public.webhook_endpoints;
create policy "webhook_endpoints: owner/admin update" on public.webhook_endpoints for update
  using (public.has_role(workspace_id, array['owner', 'admin']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin']::member_role[]));
drop policy if exists "webhook_endpoints: owner/admin delete" on public.webhook_endpoints;
create policy "webhook_endpoints: owner/admin delete" on public.webhook_endpoints for delete
  using (public.has_role(workspace_id, array['owner', 'admin']::member_role[]));

-- orders are system-written (ingest_order, security definer); members read.
drop policy if exists "external_orders: members read" on public.external_orders;
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
