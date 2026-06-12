// Post-schema bootstrap: creates the platform admin account
// (pre-confirmed, no email needed) and flags it as super admin.
//
// Requires in .env:  SUPABASE_SERVICE_ROLE_KEY  (never shipped to the client —
// Vite only exposes VITE_-prefixed vars).
//
// Usage: node scripts/post-setup.mjs <email> <password>
process.loadEnvFile('.env');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const [email, password] = process.argv.slice(2);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
if (!email || !password) {
  console.error('Usage: node scripts/post-setup.mjs <email> <password>');
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function api(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, { headers, ...options });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

// 1. create the user, pre-confirmed (idempotent: reuse if it exists)
let userId;
const created = await api('/auth/v1/admin/users', {
  method: 'POST',
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Dynamico Admin' },
  }),
});

if (created.ok) {
  userId = created.body.id;
  console.log(`created user ${email} (${userId})`);
} else if (created.status === 422 || /already/i.test(JSON.stringify(created.body))) {
  const list = await api(`/auth/v1/admin/users?page=1&per_page=100`);
  const existing = list.body?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!existing) {
    console.error('User exists but could not be found:', created.body);
    process.exit(2);
  }
  userId = existing.id;
  console.log(`user ${email} already exists (${userId})`);
} else {
  console.error('Failed to create user:', created.status, created.body);
  process.exit(2);
}

// 2. flag as platform super admin (profile row was created by trigger)
const updated = await api(`/rest/v1/profiles?id=eq.${userId}`, {
  method: 'PATCH',
  body: JSON.stringify({ is_super_admin: true }),
});
if (!updated.ok) {
  console.error('Failed to set super admin flag:', updated.status, updated.body);
  process.exit(3);
}

console.log(`OK: ${email} is now a confirmed platform super admin.`);
console.log('Sign in at the app and visit /admin for the platform console.');
