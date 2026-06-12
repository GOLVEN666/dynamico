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
create policy "profiles: read own or teammates"
  on public.profiles for select
  using (id = auth.uid() or public.shares_workspace(id));

create policy "profiles: update own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------- workspaces ----------
create policy "workspaces: members read"
  on public.workspaces for select
  using (public.is_member(id));

-- creation happens through create_workspace() (security definer);
-- no direct insert policy keeps slugs/memberships consistent.

create policy "workspaces: owner/admin update"
  on public.workspaces for update
  using (public.has_role(id, array['owner', 'admin']::member_role[]))
  with check (public.has_role(id, array['owner', 'admin']::member_role[]));

create policy "workspaces: owner delete"
  on public.workspaces for delete
  using (public.has_role(id, array['owner']::member_role[]));

-- ---------- workspace_members ----------
create policy "members: members read"
  on public.workspace_members for select
  using (public.is_member(workspace_id));

-- inserts happen through create_workspace()/add_member_by_email()
-- (security definer) so role rules live in one place.

create policy "members: owner/admin change roles"
  on public.workspace_members for update
  using (public.has_role(workspace_id, array['owner', 'admin']::member_role[])
         and role <> 'owner')
  with check (role <> 'owner');

create policy "members: owner/admin remove, or leave"
  on public.workspace_members for delete
  using (
    role <> 'owner'
    and (user_id = auth.uid()
         or public.has_role(workspace_id, array['owner', 'admin']::member_role[]))
  );

-- ---------- settings ----------
create policy "settings: members read"
  on public.settings for select
  using (public.is_member(workspace_id));

create policy "settings: owner/admin update"
  on public.settings for update
  using (public.has_role(workspace_id, array['owner', 'admin']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin']::member_role[]));

-- ---------- operational tables: viewer reads, member+ writes ----------
-- categories
create policy "categories: members read" on public.categories for select
  using (public.is_member(workspace_id));
create policy "categories: member+ insert" on public.categories for insert
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
create policy "categories: member+ update" on public.categories for update
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
create policy "categories: member+ delete" on public.categories for delete
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- suppliers
create policy "suppliers: members read" on public.suppliers for select
  using (public.is_member(workspace_id));
create policy "suppliers: member+ insert" on public.suppliers for insert
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
create policy "suppliers: member+ update" on public.suppliers for update
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
create policy "suppliers: member+ delete" on public.suppliers for delete
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- warehouses
create policy "warehouses: members read" on public.warehouses for select
  using (public.is_member(workspace_id));
create policy "warehouses: member+ insert" on public.warehouses for insert
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
create policy "warehouses: member+ update" on public.warehouses for update
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
create policy "warehouses: member+ delete" on public.warehouses for delete
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- products
create policy "products: members read" on public.products for select
  using (public.is_member(workspace_id));
create policy "products: member+ insert" on public.products for insert
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
create policy "products: member+ update" on public.products for update
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
create policy "products: member+ delete" on public.products for delete
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- product_images
create policy "product_images: members read" on public.product_images for select
  using (public.is_member(workspace_id));
create policy "product_images: member+ insert" on public.product_images for insert
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
create policy "product_images: member+ update" on public.product_images for update
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
create policy "product_images: member+ delete" on public.product_images for delete
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- stock_levels: READ ONLY for everyone. The apply_stock_movement
-- trigger (security definer) is the only writer.
create policy "stock_levels: members read" on public.stock_levels for select
  using (public.is_member(workspace_id));

-- stock_movements: immutable ledger — insert only, no update/delete.
create policy "stock_movements: members read" on public.stock_movements for select
  using (public.is_member(workspace_id));
create policy "stock_movements: member+ insert" on public.stock_movements for insert
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- purchase_orders
create policy "purchase_orders: members read" on public.purchase_orders for select
  using (public.is_member(workspace_id));
create policy "purchase_orders: member+ insert" on public.purchase_orders for insert
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
create policy "purchase_orders: member+ update" on public.purchase_orders for update
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
create policy "purchase_orders: member+ delete" on public.purchase_orders for delete
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- purchase_order_items
create policy "po_items: members read" on public.purchase_order_items for select
  using (public.is_member(workspace_id));
create policy "po_items: member+ insert" on public.purchase_order_items for insert
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
create policy "po_items: member+ update" on public.purchase_order_items for update
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));
create policy "po_items: member+ delete" on public.purchase_order_items for delete
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- alerts: system-created; members may resolve/dismiss (update only).
create policy "alerts: members read" on public.alerts for select
  using (public.is_member(workspace_id));
create policy "alerts: member+ update" on public.alerts for update
  using (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]))
  with check (public.has_role(workspace_id, array['owner', 'admin', 'member']::member_role[]));

-- activity_logs: append-only via triggers; members read.
create policy "activity_logs: members read" on public.activity_logs for select
  using (public.is_member(workspace_id));

-- ---------- storage: product images ----------
-- Objects live under {workspace_id}/{filename}; the first path
-- segment gates access by membership.
create policy "product images: public read"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "product images: members upload"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and public.is_member(((storage.foldername(name))[1])::uuid)
  );

create policy "product images: members delete"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and public.is_member(((storage.foldername(name))[1])::uuid)
  );
