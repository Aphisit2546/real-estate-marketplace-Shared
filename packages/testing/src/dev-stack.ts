import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startTestDatabase } from './database';
import { startFakeSupabase } from './fake-supabase';

/**
 * Runs the whole product on this machine without Docker or a Supabase project:
 * real PostgreSQL with the real migrations, plus a local stand-in for Auth and
 * Storage. Used by `pnpm dev:local` and the Playwright suite. Data is discarded on exit.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const AUTH_PORT = 54321;
const API_PORT = 4000;
const WEB_PORT = 3000;
const ADMIN = { email: 'admin@example.com', password: 'Password123' };

const db = await startTestDatabase();
const supabase = await startFakeSupabase(db.sql, {
  port: AUTH_PORT,
  autoConfirm: process.env.REM_AUTO_CONFIRM !== 'false',
});

await db.sql`
  insert into auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
  values (${ADMIN.email}, encode(sha256(${ADMIN.password}::bytea), 'hex'), now(), ${db.sql.json({ display_name: 'ผู้ดูแลระบบ' })})`;
await db.sql`
  insert into public.user_roles (user_id, role)
  select id, 'admin' from auth.users where email = ${ADMIN.email}`;

const secret = 'local-only-proxy-secret';
const env = {
  ...process.env,
  DATABASE_URL: db.url,
  SUPABASE_URL: supabase.url,
  SUPABASE_SERVICE_ROLE_KEY: supabase.serviceKey,
  WEB_URL: `http://localhost:${WEB_PORT}`,
  SITE_URL: `http://localhost:${WEB_PORT}`,
  API_BASE_URL: `http://localhost:${API_PORT}`,
  ALLOWED_ORIGINS: 'http://localhost:8081',
  INTERNAL_PROXY_SECRET: secret,
  IMAGE_ORIGIN: supabase.url,
  CRON_SECRET: 'local-only-cron-secret',
  DATABASE_POOL_MAX: '10',
};

const mode = process.env.REM_STACK_MODE ?? 'dev';
const children: ChildProcess[] = ['@rem/api', '@rem/web'].map((name) =>
  spawn('pnpm', ['--filter', name, mode], { cwd: root, env, stdio: 'inherit', shell: true }));

console.info(`\nLocal stack ready:\n  Web  http://localhost:${WEB_PORT}\n  API  http://localhost:${API_PORT}/api/v1\n  Admin ${ADMIN.email} / ${ADMIN.password}\n`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  await supabase.stop().catch(() => undefined);
  await db.stop().catch(() => undefined);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
