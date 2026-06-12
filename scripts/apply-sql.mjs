// One-off migration runner: tries the direct host, then the eu-west-1
// pooler (session mode), and applies supabase/setup.sql.
// Usage: node scripts/apply-sql.mjs <db-password> [sql-file]
import { readFileSync } from 'node:fs';
import pg from 'pg';

const password = process.argv[2];
const sqlFile = process.argv[3] ?? 'supabase/setup.sql';
if (!password) {
  console.error('Usage: node scripts/apply-sql.mjs <db-password> [sql-file]');
  process.exit(1);
}

const REF = 'dfbyfjfrolrrvznqiliv';
const candidates = [
  {
    label: 'direct (IPv6)',
    config: {
      host: `db.${REF}.supabase.co`,
      port: 5432,
      user: 'postgres',
      database: 'postgres',
    },
  },
  {
    label: 'pooler eu-west-1 (session)',
    config: {
      host: 'aws-0-eu-west-1.pooler.supabase.com',
      port: 5432,
      user: `postgres.${REF}`,
      database: 'postgres',
    },
  },
];

async function connect() {
  for (const { label, config } of candidates) {
    const client = new pg.Client({
      ...config,
      password,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 12000,
    });
    try {
      await client.connect();
      console.log(`connected via ${label}`);
      return client;
    } catch (error) {
      console.error(`${label}: ${error.message}`);
      try { await client.end(); } catch { /* noop */ }
    }
  }
  return null;
}

const client = await connect();
if (!client) {
  console.error('FAILED: could not connect with any candidate');
  process.exit(2);
}

try {
  const sql = readFileSync(sqlFile, 'utf8').replace(/^﻿/, '');
  await client.query(sql);
  console.log(`OK: applied ${sqlFile}`);
} catch (error) {
  console.error(`SQL ERROR: ${error.message}${error.position ? ` (position ${error.position})` : ''}`);
  process.exitCode = 3;
} finally {
  await client.end();
}
