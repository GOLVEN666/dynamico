-- ============================================================
-- Dynamico — 00001 Schema
-- Tables, enums, indexes, updated_at triggers, auth profile sync
-- ============================================================

-- ---------- Enums ----------
create type member_role as enum ('owner', 'admin', 'member', 'viewer');
create type product_status as enum ('draft', 'active', 'archived');
create type movement_type as enum ('in', 'out', 'adjustment', 'transfer_in', 'transfer_out');
create type po_status as enum ('draft', 'ordered', 'received', 'cancelled');
create type alert_type as enum ('low_stock', 'out_of_stock');
create type alert_status as enum ('active', 'resolved', 'dismissed');

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
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_idx on public.profiles (lower(email));

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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- workspaces ----------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}$'),
  logo_url text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

-- ---------- workspace_members ----------
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role member_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members (user_id);
create index workspace_members_workspace_idx on public.workspace_members (workspace_id);

-- ---------- settings (1 row per workspace) ----------
create table public.settings (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  currency text not null default 'USD',
  timezone text not null default 'UTC',
  low_stock_alerts_enabled boolean not null default true,
  out_of_stock_alerts_enabled boolean not null default true,
  po_counter integer not null default 0,
  updated_at timestamptz not null default now()
);

create trigger settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- ---------- categories ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);

create index categories_workspace_idx on public.categories (workspace_id);

-- ---------- suppliers ----------
create table public.suppliers (
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

create index suppliers_workspace_idx on public.suppliers (workspace_id);

create trigger suppliers_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- ---------- warehouses ----------
create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  location text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index warehouses_workspace_idx on public.warehouses (workspace_id);

create trigger warehouses_updated_at
  before update on public.warehouses
  for each row execute function public.set_updated_at();

-- ---------- products ----------
create table public.products (
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

create index products_workspace_idx on public.products (workspace_id);
create index products_category_idx on public.products (category_id);
create index products_supplier_idx on public.products (supplier_id);
create index products_name_idx on public.products (workspace_id, lower(name));

create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------- product_images ----------
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  url text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index product_images_product_idx on public.product_images (product_id);
create index product_images_workspace_idx on public.product_images (workspace_id);

-- ---------- stock_levels ----------
-- Derived state. NEVER written by clients — only by the
-- apply_stock_movement trigger. No write RLS policies exist.
create table public.stock_levels (
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

create index stock_levels_workspace_idx on public.stock_levels (workspace_id);
create index stock_levels_warehouse_idx on public.stock_levels (warehouse_id);

-- ---------- stock_movements ----------
-- Immutable ledger. Inserts only; no update/delete policies.
create table public.stock_movements (
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

create index stock_movements_workspace_created_idx
  on public.stock_movements (workspace_id, created_at desc);
create index stock_movements_product_idx on public.stock_movements (product_id);
create index stock_movements_warehouse_idx on public.stock_movements (warehouse_id);

-- ---------- purchase_orders ----------
create table public.purchase_orders (
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

create index purchase_orders_workspace_idx on public.purchase_orders (workspace_id, created_at desc);
create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id);

create trigger purchase_orders_updated_at
  before update on public.purchase_orders
  for each row execute function public.set_updated_at();

-- ---------- purchase_order_items ----------
create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12, 2) not null default 0 check (unit_cost >= 0),
  received_quantity integer not null default 0 check (received_quantity >= 0)
);

create index po_items_po_idx on public.purchase_order_items (purchase_order_id);
create index po_items_workspace_idx on public.purchase_order_items (workspace_id);

-- ---------- alerts ----------
-- Created/resolved automatically by the stock movement trigger.
create table public.alerts (
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

create index alerts_workspace_idx on public.alerts (workspace_id, status, created_at desc);
-- At most one ACTIVE alert per product/warehouse/type
create unique index alerts_active_unique
  on public.alerts (product_id, warehouse_id, type)
  where status = 'active';

-- ---------- activity_logs ----------
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,        -- e.g. 'products.created'
  entity_type text not null,   -- e.g. 'products'
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_logs_workspace_idx on public.activity_logs (workspace_id, created_at desc);

-- ---------- storage bucket for product images ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
