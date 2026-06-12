// Applies a SQL file through the Supabase Management API.
// Usage: node scripts/apply-via-api.mjs <sbp_access_token> [sql-file]
import { readFileSync } from 'node:fs';

const token = process.argv[2];
const file = process.argv[3] ?? 'supabase/setup.sql';
if (!token?.startsWith('sbp_')) {
  console.error('Usage: node scripts/apply-via-api.mjs <sbp_access_token> [sql-file]');
  process.exit(1);
}

const sql = readFileSync(file, 'utf8').replace(/^﻿/, '');

const res = await fetch(
  'https://api.supabase.com/v1/projects/dfbyfjfrolrrvznqiliv/database/query',
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  },
);

const text = await res.text();
if (res.ok) {
  console.log(`OK (${res.status}): ${file} applied.`);
} else {
  console.error(`FAILED (${res.status}): ${text.slice(0, 2000)}`);
  process.exit(2);
}
