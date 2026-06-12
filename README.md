# Dynamico

Stock management for ecommerce brands — a multi-workspace SaaS dashboard built on **React 19 + TypeScript + Supabase + Tailwind CSS v4**.

🌐 **Live:** https://dynamico-sable.vercel.app · Projet de Fin d'Études par **Nidaa Cherqui** — **Mega Campus** (2025–2026)

![stack](https://img.shields.io/badge/React-19-blue) ![stack](https://img.shields.io/badge/Supabase-Postgres%20%2B%20RLS-3ecf8e) ![stack](https://img.shields.io/badge/Tailwind-v4-38bdf8)

## Features

- **Multi-workspace** with team roles (`owner` / `admin` / `member` / `viewer`)
- **Products** with SKU, barcode, categories, suppliers, images (Supabase Storage)
- **Stock per warehouse**, driven by an **immutable movement ledger** (in / out / adjustment / transfer)
- **Automatic alerts** — low-stock and out-of-stock, raised and resolved by database triggers
- **Purchase orders** with auto-numbering; receiving a PO stocks in every line item atomically
- **Analytics** — inventory value, 7/30/90-day flow, category mix, top products
- **Activity log** — trigger-based audit trail of every important action
- **Order webhooks** — Shopify / WooCommerce / custom systems push orders in; lines are matched by SKU and recorded as stock-out movements (idempotent, oversells flagged as partial)
- **Platform admin** — super-admin accounts get a read-only console (`/admin`) across every brand workspace
- **Dark mode** — full theme toggle, persisted per device
- Premium dashboard UI: skeleton loaders, empty states, modals, toasts, responsive layout

## Architecture

```
src/
├── lib/            supabase client, react-query client + query-key factory, utils, storage
├── types/          domain types mirroring the DB schema
├── contexts/       Auth (session/profile), Workspace (active tenant + role), Toast
├── hooks/          ALL Supabase access lives here (React Query) — pages never query directly
├── components/
│   ├── ui/         primitives: Button, Input, Select, Dialog, Dropdown, Badge, Tabs, …
│   ├── shared/     DataTable, StatCard, ChartCard, AlertPanel, ActivityFeed, EmptyState, …
│   ├── layout/     AppLayout, Sidebar, Topbar
│   ├── products/   ProductForm, ProductCard
│   └── stock/      MovementDialog, TransferDialog
└── pages/          one folder/file per route
```

**Key invariants (enforced in Postgres, not the client):**

1. `stock_levels` is derived state — clients have **no write policy**. The only mutation path is inserting into `stock_movements`; the `apply_stock_movement()` trigger applies the delta, rejects negative stock with a descriptive error, and manages alerts.
2. `stock_movements` is an **append-only ledger** (no update/delete policies).
3. Multi-step operations are RPCs: `transfer_stock`, `receive_purchase_order`, `create_workspace`, `add_member_by_email`.
4. Every tenant table carries `workspace_id`; RLS gates reads by membership and writes by role via `is_member()` / `has_role()` (SECURITY DEFINER helpers, no recursive policies).
5. Activity logging is trigger-based — the app cannot forget to log.

## Setup

### 1. Database

Project ref: `dfbyfjfrolrrvznqiliv`.

Run the migrations against your Supabase project — either:

- **SQL Editor (fastest):** paste [`supabase/setup.sql`](supabase/setup.sql) (all four migrations combined) into the Supabase Dashboard → SQL Editor and run it once, or
- **Migrations:** run `supabase/migrations/00001_schema.sql` … `00004_admin_webhooks.sql` in order (Supabase CLI or the MCP server once authenticated via `claude /mcp`).

Then bootstrap the platform admin account (pre-confirmed, flagged super-admin):

```bash
node scripts/post-setup.mjs test@tester.com <password>
```

### 2. Auth

In Supabase Dashboard → Authentication → Providers, ensure **Email** is enabled.
For local development you may want to disable "Confirm email" so signups log in immediately (the Register page handles both modes).

### 3. Environment

```bash
cp .env.example .env
```

Fill in the anon key from Dashboard → Project Settings → API:

```
VITE_SUPABASE_URL=https://dfbyfjfrolrrvznqiliv.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon key>
```

### 4. Run

```bash
npm install
npm run dev
```

Register → onboarding creates your workspace + first warehouse → start adding products.

## Roles

| Capability                       | Owner | Admin | Member | Viewer |
| -------------------------------- | :---: | :---: | :----: | :----: |
| View all workspace data          |  ✅   |  ✅   |   ✅   |   ✅   |
| Products / stock / POs / alerts  |  ✅   |  ✅   |   ✅   |   —    |
| Team & settings management       |  ✅   |  ✅   |   —    |   —    |
| Delete workspace                 |  ✅   |   —   |   —    |   —    |

Roles are enforced **both** in RLS policies and in the UI (`canEdit` / `canManage`).

## Business rules (DB-enforced)

- Product created with initial stock → recorded as `in` movements (`INITIAL` reference)
- Movement inserted → `stock_levels` upserted; negative results rejected
- Stock ≤ minimum → `low_stock` alert; stock = 0 → `out_of_stock` alert (deduplicated via partial unique index); recovery auto-resolves
- PO received → outstanding quantities stocked in, items marked received, PO closed
- Transfer → two linked ledger rows (`transfer_group`), atomic
- PO numbers (`PO-0001`, …) from a race-safe per-workspace counter

## Order webhooks

Create an endpoint on the **Integrations** page → you get a tokenized URL:

```
https://dfbyfjfrolrrvznqiliv.supabase.co/functions/v1/order-webhook?token=<token>
```

- **Shopify:** Settings → Notifications → Webhooks → "Order creation" → paste the URL
- **WooCommerce:** Settings → Advanced → Webhooks → topic "Order created" → paste the URL
- **Custom systems:** POST `{ "external_id", "order_number", "items": [{ "sku", "qty" }] }` to the same URL, or call the `ingest_order(p_token, p_payload)` RPC directly via PostgREST

Deploy the bridge function once (Shopify/Woo can't set Supabase auth headers — the endpoint token is the credential; `verify_jwt` is disabled in [supabase/config.toml](supabase/config.toml)):

```bash
supabase functions deploy order-webhook --project-ref dfbyfjfrolrrvznqiliv
```

Processing is idempotent per `(source, external_id)` — webhook retries never double-deduct. Unknown SKUs or insufficient stock degrade the order to `partial`/`failed` with per-line errors visible on the Integrations page.

## Platform admin

`profiles.is_super_admin = true` grants read-only visibility across **all** workspaces (RLS-level, via `is_member()`), plus the `/admin` console listing every brand, owner, member count and product count. Grant it with `scripts/post-setup.mjs` or:

```sql
update public.profiles set is_super_admin = true where lower(email) = 'you@example.com';
```

## Notes / next steps

- Generate typed DB definitions with `supabase gen types typescript` and thread them through the client for end-to-end query typing.
- Email invitations (currently "add by email" requires an existing account — no email service needed).
- Realtime subscriptions for live stock/alert updates are a natural extension (`supabase.channel`).
