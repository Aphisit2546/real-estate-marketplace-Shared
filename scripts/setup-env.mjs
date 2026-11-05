// Creates apps/api/.env.local and apps/web/.env.local for the linked Supabase project.
// The secret key goes straight into the file and is never printed.
// Usage: pnpm setup:env
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const ref = readFileSync('supabase/.temp/project-ref', 'utf8').trim();
const poolerHost = new URL(readFileSync('supabase/.temp/pooler-url', 'utf8').trim()).hostname;

const keys = JSON.parse(execSync('pnpm exec supabase projects api-keys --reveal -o json', {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
}));
const secret = keys.find((key) => key.type === 'secret')?.api_key;
if (!secret) throw new Error('No secret API key found for this project');

const proxySecret = randomBytes(32).toString('hex');

const files = {
  'apps/api/.env.local': `SUPABASE_URL=https://${ref}.supabase.co
SUPABASE_SERVICE_ROLE_KEY=${secret}
# Replace YOUR_DB_PASSWORD. URL-encode it if it contains symbols such as @ : / ? #
DATABASE_URL=postgres://postgres.${ref}:YOUR_DB_PASSWORD@${poolerHost}:6543/postgres
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8081
WEB_URL=http://localhost:3000
INTERNAL_PROXY_SECRET=${proxySecret}
CRON_SECRET=${randomBytes(32).toString('hex')}
EXPO_PUSH_ENABLED=false
`,
  'apps/web/.env.local': `SITE_URL=http://localhost:3000
API_BASE_URL=http://localhost:4000
INTERNAL_PROXY_SECRET=${proxySecret}
IMAGE_ORIGIN=https://${ref}.supabase.co
`,
};

for (const [file, body] of Object.entries(files)) {
  if (existsSync(file)) {
    console.info(`skipped ${file} (already exists)`);
    continue;
  }
  writeFileSync(file, body);
  console.info(`wrote ${file}`);
}
console.info('Next: replace YOUR_DB_PASSWORD in apps/api/.env.local');
