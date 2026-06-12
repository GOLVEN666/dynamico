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

create trigger products_log after insert or update or delete on public.products
  for each row execute function public.log_activity();
create trigger suppliers_log after insert or update or delete on public.suppliers
  for each row execute function public.log_activity();
create trigger warehouses_log after insert or update or delete on public.warehouses
  for each row execute function public.log_activity();
create trigger categories_log after insert or delete on public.categories
  for each row execute function public.log_activity();
create trigger purchase_orders_log after insert or update or delete on public.purchase_orders
  for each row execute function public.log_activity();
create trigger stock_movements_log after insert on public.stock_movements
  for each row execute function public.log_activity();
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
