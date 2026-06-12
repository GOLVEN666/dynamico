// Regenerates supabase/setup.sql from the migrations, transformed to be
// fully idempotent so it can be re-run against a partially-created DB:
//   - enums          -> guarded DO blocks
//   - tables/indexes -> IF NOT EXISTS
//   - triggers       -> DROP TRIGGER IF EXISTS first
//   - policies       -> DROP POLICY IF EXISTS first
//   - functions      -> already CREATE OR REPLACE
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = 'supabase/migrations';
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

let sql = files
  .map((f) => {
    const body = readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, '');
    return `-- ============================================================\n-- ${f}\n-- ============================================================\n\n${body}`;
  })
  .join('\n\n');

// 1. enums -> DO blocks
sql = sql.replace(
  /^create type (\w+) as enum \(([^)]+)\);/gm,
  (_m, name, values) =>
    `do $do$ begin\n  create type ${name} as enum (${values});\nexception when duplicate_object then null;\nend $do$;`,
);

// 2. tables -> IF NOT EXISTS
sql = sql.replace(/^create table (public\.\w+)/gm, 'create table if not exists $1');

// 3. indexes -> IF NOT EXISTS
sql = sql.replace(/^create index (\w+)/gm, 'create index if not exists $1');
sql = sql.replace(/^create unique index (\w+)/gm, 'create unique index if not exists $1');

// 4. triggers -> drop first (capture name + target table across lines)
sql = sql.replace(
  /^create trigger (\w+)([\s\S]*?\bon (public\.\w+|auth\.users|storage\.\w+))/gm,
  (_m, name, rest) => {
    const table = rest.match(/\bon (public\.\w+|auth\.users|storage\.\w+)/)[1];
    return `drop trigger if exists ${name} on ${table};\ncreate trigger ${name}${rest}`;
  },
);

// 5. policies -> drop first
sql = sql.replace(
  /^create policy "([^"]+)"([\s\S]*?\bon (public\.\w+|storage\.objects))/gm,
  (_m, name, rest) => {
    const table = rest.match(/\bon (public\.\w+|storage\.objects)/)[1];
    return `drop policy if exists "${name}" on ${table};\ncreate policy "${name}"${rest}`;
  },
);

// 6. plain drop policy (00004) -> if exists
sql = sql.replace(/^drop policy "([^"]+)"/gm, 'drop policy if exists "$1"');

const header = `-- ============================================================
-- Dynamico — complete database setup (IDEMPOTENT)
-- Generated from supabase/migrations/*.sql
-- Safe to run multiple times: existing objects are skipped or replaced.
-- ============================================================\n\n`;

writeFileSync('supabase/setup.sql', header + sql, 'utf8');

// sanity report
const counts = {
  'DO blocks (enums)': (sql.match(/exception when duplicate_object/g) || []).length,
  'tables if-not-exists': (sql.match(/create table if not exists/g) || []).length,
  'indexes if-not-exists': (sql.match(/create (unique )?index if not exists/g) || []).length,
  'trigger drops': (sql.match(/drop trigger if exists/g) || []).length,
  'policy drops': (sql.match(/drop policy if exists/g) || []).length,
  'create policies': (sql.match(/^create policy/gm) || []).length,
  'create triggers': (sql.match(/^create trigger/gm) || []).length,
};
console.log(counts);
