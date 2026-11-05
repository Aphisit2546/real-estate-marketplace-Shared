import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import postgres from 'postgres';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * The subset of Supabase's platform schema that migrations depend on. Only what
 * Supabase itself provides belongs here; everything else must come from
 * supabase/migrations so the tests exercise the real files.
 */
const SUPABASE_PLATFORM_SQL = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  create schema extensions;
  create schema storage;

  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    encrypted_password text,
    email_confirmed_at timestamptz,
    banned_until timestamptz,
    raw_user_meta_data jsonb not null default '{}',
    created_at timestamptz not null default now()
  );

  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;

  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text,
    owner uuid
  );
  alter table storage.objects enable row level security;

  grant usage on schema public, auth, extensions, storage to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export interface TestDatabase {
  url: string;
  port: number;
  sql: postgres.Sql;
  stop(): Promise<void>;
}

export function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolvePort(port));
    });
  });
}

export function listMigrations(): string[] {
  const dir = join(repoRoot, 'supabase', 'migrations');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => join(dir, file));
}

export async function startTestDatabase(options: { port?: number; dataDir?: string } = {}): Promise<TestDatabase> {
  const port = options.port ?? (await freePort());
  const password = 'local-test-only';
  const databaseDir = options.dataDir ?? mkdtempSync(join(tmpdir(), 'rem-pg-'));

  const server = new EmbeddedPostgres({
    databaseDir,
    user: 'postgres',
    password,
    port,
    persistent: false,
    onLog: () => undefined,
    onError: () => undefined,
  });
  await server.initialise();
  await server.start();

  const url = `postgres://postgres:${password}@127.0.0.1:${port}/postgres`;
  const sql = postgres(url, { max: 5, onnotice: () => undefined });

  await sql.unsafe(SUPABASE_PLATFORM_SQL);
  for (const file of listMigrations()) {
    await sql.unsafe(readFileSync(file, 'utf8'));
  }
  for (const seed of ['seed.sql', 'seed-locations.sql']) {
    await sql.unsafe(readFileSync(join(repoRoot, 'supabase', seed), 'utf8'));
  }

  return {
    url,
    port,
    sql,
    async stop() {
      await sql.end({ timeout: 2 });
      await server.stop();
      rmSync(databaseDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    },
  };
}

export type ClaimRole = 'anon' | 'authenticated' | 'service_role';

/** Runs `fn` exactly as a request would: inside a transaction, as a restricted role. */
export async function asRole<T>(
  sql: postgres.Sql,
  role: ClaimRole,
  userId: string | null,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  const result = await sql.begin(async (tx) => {
    const claims = JSON.stringify(userId ? { sub: userId, role } : { role });
    await tx`select set_config('role', ${role}, true), set_config('request.jwt.claims', ${claims}, true)`;
    return fn(tx);
  });
  return result as T;
}
