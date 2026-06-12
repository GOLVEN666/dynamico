// Order webhook bridge for Shopify / WooCommerce / custom systems.
//
// Platforms POST their native order payload here; the function forwards
// it to the ingest_order() RPC which matches lines by SKU and records
// stock-out movements. Authentication: ?token=<endpoint token> from the
// Integrations page (Shopify/Woo cannot send custom headers).
//
// Deploy:
//   supabase functions deploy order-webhook --project-ref dfbyfjfrolrrvznqiliv
// (verify_jwt is disabled in supabase/config.toml — the token is the auth.)
import { createClient } from 'npm:@supabase/supabase-js@2';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const token = new URL(req.url).searchParams.get('token');
  if (!token) {
    return json({ error: 'Missing ?token= parameter' }, 401);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await supabase.rpc('ingest_order', {
    p_token: token,
    p_payload: payload,
  });

  if (error) {
    // invalid token or malformed payload — tell the platform not to retry forever
    return json({ error: error.message }, 401);
  }
  return json(data);
});
