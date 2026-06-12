// End-to-end smoke test against the live Supabase project.
// Exercises: auth -> workspace -> warehouses -> product -> ledger ->
// alerts -> transfer -> insufficient-stock guard -> webhook ingestion ->
// idempotency -> analytics. Leaves a demo workspace behind.
//
// Usage: node scripts/smoke-test.mjs <email> <password>
process.loadEnvFile('.env');

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const [email, password] = process.argv.slice(2);

let passed = 0;
let failed = 0;
function check(label, condition, detail = '') {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label} ${detail}`);
  }
}

async function api(path, { token = ANON, method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${URL}${path}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* empty body */ }
  return { ok: res.ok, status: res.status, json, text };
}

// ---------- 1. sign in ----------
const auth = await api('/auth/v1/token?grant_type=password', {
  method: 'POST',
  body: { email, password },
});
check('sign in', auth.ok, auth.text);
if (!auth.ok) process.exit(1);
const token = auth.json.access_token;

// ---------- 2. workspace via RPC ----------
const slug = `demo-brand-${Math.random().toString(36).slice(2, 6)}`;
const ws = await api('/rest/v1/rpc/create_workspace', {
  token, method: 'POST',
  body: { p_name: 'Demo Brand', p_slug: slug },
});
check('create_workspace RPC', ws.ok && ws.json?.id, ws.text);
const wsId = ws.json.id;

// ---------- 3. warehouses ----------
const rest = (path, opts) => api(`/rest/v1/${path}`, { token, ...opts });
const post = (path, body) =>
  rest(path, { method: 'POST', body, headers: { Prefer: 'return=representation' } });

const wh1 = await post('warehouses', { workspace_id: wsId, name: 'Entrepot Casablanca', is_default: true });
const wh2 = await post('warehouses', { workspace_id: wsId, name: 'Entrepot Rabat' });
check('create 2 warehouses', wh1.ok && wh2.ok, wh1.text + wh2.text);
const wh1Id = wh1.json[0].id;
const wh2Id = wh2.json[0].id;

// ---------- 4. product (min stock 5 to trigger alerts) ----------
const product = await post('products', {
  workspace_id: wsId, name: 'T-shirt Bio Noir M', sku: 'TSHIRT-BLK-M',
  cost_price: 8.5, selling_price: 24.9, minimum_stock: 5,
});
check('create product', product.ok, product.text);
const productId = product.json[0].id;

// ---------- 5. stock in +20 -> level 20 ----------
const movIn = await post('stock_movements', {
  workspace_id: wsId, product_id: productId, warehouse_id: wh1Id,
  type: 'in', quantity: 20, reference: 'INITIAL',
});
check('stock in +20', movIn.ok, movIn.text);
let levels = await rest(`stock_levels?product_id=eq.${productId}&warehouse_id=eq.${wh1Id}`);
check('stock_levels = 20 (trigger applied)', levels.json?.[0]?.quantity === 20, JSON.stringify(levels.json));

// ---------- 6. transfer 5 -> 15 / 5 ----------
const transfer = await api('/rest/v1/rpc/transfer_stock', {
  token, method: 'POST',
  body: { p_product_id: productId, p_from_warehouse_id: wh1Id, p_to_warehouse_id: wh2Id, p_quantity: 5 },
});
check('transfer_stock RPC', transfer.ok, transfer.text);
levels = await rest(`stock_levels?product_id=eq.${productId}&order=quantity.desc`);
check('levels after transfer = 15 / 5',
  levels.json?.[0]?.quantity === 15 && levels.json?.[1]?.quantity === 5, JSON.stringify(levels.json));

// ---------- 7. stock out -12 -> 3 left -> low stock alert ----------
const movOut = await post('stock_movements', {
  workspace_id: wsId, product_id: productId, warehouse_id: wh1Id, type: 'out', quantity: 12,
});
check('stock out -12', movOut.ok, movOut.text);
const lowAlerts = await rest(`alerts?product_id=eq.${productId}&warehouse_id=eq.${wh1Id}&status=eq.active`);
check('low_stock alert auto-created (3 <= min 5)',
  lowAlerts.json?.some((a) => a.type === 'low_stock'), JSON.stringify(lowAlerts.json));

// ---------- 8. overdraw guard ----------
const overdraw = await post('stock_movements', {
  workspace_id: wsId, product_id: productId, warehouse_id: wh1Id, type: 'out', quantity: 999,
});
check('insufficient stock rejected with friendly error',
  !overdraw.ok && overdraw.text.includes('Insufficient stock'), overdraw.text.slice(0, 120));

// ---------- 9. webhook endpoint + order ingestion ----------
const endpoint = await post('webhook_endpoints', {
  workspace_id: wsId, name: 'Boutique Shopify', source: 'custom', warehouse_id: wh1Id,
});
check('create webhook endpoint', endpoint.ok, endpoint.text);
const webhookToken = endpoint.json[0].token;

// anonymous call — exactly how an external system would hit it
const order = await api('/rest/v1/rpc/ingest_order', {
  method: 'POST',
  body: {
    p_token: webhookToken,
    p_payload: {
      external_id: 'order-1001', order_number: '#1001',
      items: [{ sku: 'TSHIRT-BLK-M', qty: 2 }, { sku: 'UNKNOWN-SKU', qty: 1 }],
    },
  },
});
check('ingest_order processes (1 matched, 1 unknown -> partial)',
  order.ok && order.json?.status === 'partial' && order.json?.matched === 1, order.text);
levels = await rest(`stock_levels?product_id=eq.${productId}&warehouse_id=eq.${wh1Id}`);
check('webhook deducted stock (3 - 2 = 1)', levels.json?.[0]?.quantity === 1, JSON.stringify(levels.json));

// retry with same external id — must not double-deduct
const dupe = await api('/rest/v1/rpc/ingest_order', {
  method: 'POST',
  body: { p_token: webhookToken, p_payload: { external_id: 'order-1001', order_number: '#1001', items: [{ sku: 'TSHIRT-BLK-M', qty: 2 }] } },
});
check('webhook retry is idempotent (duplicate)', dupe.json?.status === 'duplicate', dupe.text);

// bad token rejected
const badToken = await api('/rest/v1/rpc/ingest_order', {
  method: 'POST',
  body: { p_token: 'not-a-real-token', p_payload: { items: [] } },
});
check('invalid webhook token rejected', !badToken.ok, badToken.text.slice(0, 80));

// ---------- 10. analytics + activity ----------
const stats = await api('/rest/v1/rpc/get_dashboard_stats', {
  token, method: 'POST', body: { p_workspace_id: wsId },
});
check('dashboard stats (1 product, 6 units total)',
  stats.json?.total_products === 1 && stats.json?.total_units === 6, JSON.stringify(stats.json));

const activity = await rest(`activity_logs?workspace_id=eq.${wsId}&select=action&limit=50`);
check('activity log populated by triggers', (activity.json?.length ?? 0) >= 8, `entries: ${activity.json?.length}`);

const orders = await rest(`external_orders?workspace_id=eq.${wsId}`);
check('external order recorded with line errors',
  orders.json?.[0]?.status === 'partial' && orders.json?.[0]?.error?.includes('UNKNOWN-SKU'),
  JSON.stringify(orders.json?.[0]?.error));

// ---------- summary ----------
console.log(`\n${passed} passed, ${failed} failed`);
console.log(`Demo workspace "Demo Brand" (${slug}) left in place for the PFE demo.`);
process.exit(failed === 0 ? 0 : 1);
