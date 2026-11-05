import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';
import type postgres from 'postgres';
import { freePort } from './database';

/**
 * Speaks the subset of Supabase's Auth and Storage HTTP protocols that the API
 * uses, so production code paths (supabase-js, JWKS verification) run unmodified
 * in tests. It is a test double: never deploy it. Passwords are only hashed with
 * SHA-256 and files live in memory.
 */
export interface FakeSupabase {
  url: string;
  port: number;
  serviceKey: string;
  /** Mints an access token the same way a real sign-in would. */
  issueToken(userId: string, email: string, options?: { expiresIn?: string }): Promise<string>;
  confirmEmail(email: string): Promise<void>;
  storedObjects(): string[];
  sentEmails: { type: string; email: string }[];
  stop(): Promise<void>;
}

interface StoredObject { body: Buffer; contentType: string }

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

export async function startFakeSupabase(
  sql: postgres.Sql,
  options: { port?: number; autoConfirm?: boolean } = {},
): Promise<FakeSupabase> {
  const port = options.port ?? (await freePort());
  const url = `http://127.0.0.1:${port}`;
  const serviceKey = `fake-service-key-${randomBytes(8).toString('hex')}`;
  const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });
  const kid = randomUUID();
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid, alg: 'ES256', use: 'sig' };
  const refreshTokens = new Map<string, { userId: string; email: string }>();
  const objects = new Map<string, StoredObject>();
  const sentEmails: { type: string; email: string }[] = [];

  const issueToken = (userId: string, email: string, opts: { expiresIn?: string } = {}) =>
    new SignJWT({ email, role: 'authenticated' })
      .setProtectedHeader({ alg: 'ES256', kid })
      .setSubject(userId)
      .setAudience('authenticated')
      .setIssuer(`${url}/auth/v1`)
      .setIssuedAt()
      .setExpirationTime(opts.expiresIn ?? '1h')
      .sign(privateKey);

  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  const authError = (res: ServerResponse, status: number, code: string, message: string) =>
    json(res, status, { code: status, error_code: code, msg: message });

  const userJson = (user: { id: string; email: string; email_confirmed_at?: Date | null }) => ({
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email,
    email_confirmed_at: user.email_confirmed_at ?? null,
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  });

  const session = async (user: { id: string; email: string }) => {
    const refreshToken = randomBytes(16).toString('hex');
    refreshTokens.set(refreshToken, { userId: user.id, email: user.email });
    return {
      access_token: await issueToken(user.id, user.email),
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: refreshToken,
      user: userJson(user),
    };
  };

  async function handleAuth(req: IncomingMessage, res: ServerResponse, path: string, query: URLSearchParams) {
    const raw = await readBody(req);
    const body = raw.length > 0 ? (JSON.parse(raw.toString()) as Record<string, unknown>) : {};

    if (path === '/.well-known/jwks.json') return json(res, 200, { keys: [jwk] });

    if (path === '/signup' && req.method === 'POST') {
      const email = String(body.email);
      const [existing] = await sql`select id from auth.users where email = ${email}`;
      if (existing) return authError(res, 422, 'user_already_exists', 'User already registered');
      const metadata = (body.data ?? {}) as Record<string, string>;
      const [user] = await sql`
        insert into auth.users (email, encrypted_password, raw_user_meta_data, email_confirmed_at)
        values (${email}, ${hash(String(body.password))}, ${sql.json(metadata)}, ${options.autoConfirm ? new Date() : null})
        returning id, email, email_confirmed_at`;
      sentEmails.push({ type: 'signup', email });
      if (options.autoConfirm) return json(res, 200, await session(user as never));
      return json(res, 200, userJson(user as never));
    }

    if (path === '/token' && req.method === 'POST') {
      const grant = query.get('grant_type');
      if (grant === 'password') {
        const [user] = await sql`
          select id, email, email_confirmed_at, encrypted_password, banned_until
          from auth.users where email = ${String(body.email)}`;
        if (!user || user.encrypted_password !== hash(String(body.password))) {
          return authError(res, 400, 'invalid_credentials', 'Invalid login credentials');
        }
        if (!user.email_confirmed_at) return authError(res, 400, 'email_not_confirmed', 'Email not confirmed');
        if (user.banned_until && new Date(user.banned_until as string) > new Date()) {
          return authError(res, 400, 'user_banned', 'User is banned');
        }
        return json(res, 200, await session(user as never));
      }
      if (grant === 'refresh_token') {
        const token = String(body.refresh_token);
        const owner = refreshTokens.get(token);
        if (!owner) return authError(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token');
        refreshTokens.delete(token); // Rotation: a refresh token works once.
        return json(res, 200, await session({ id: owner.userId, email: owner.email }));
      }
    }

    if (path === '/logout' && req.method === 'POST') {
      res.writeHead(204).end();
      return;
    }

    if (path === '/recover' && req.method === 'POST') {
      sentEmails.push({ type: 'recovery', email: String(body.email) });
      return json(res, 200, {});
    }

    if (path === '/resend' && req.method === 'POST') {
      sentEmails.push({ type: 'resend', email: String(body.email) });
      return json(res, 200, {});
    }

    const adminUser = path.match(/^\/admin\/users\/([0-9a-f-]+)$/);
    if (adminUser && req.method === 'PUT') {
      if (req.headers.authorization !== `Bearer ${serviceKey}`) return authError(res, 401, 'no_authorization', 'Unauthorized');
      const id = adminUser[1]!;
      if (typeof body.password === 'string') {
        await sql`update auth.users set encrypted_password = ${hash(body.password)} where id = ${id}`;
      }
      if (typeof body.ban_duration === 'string') {
        const until = body.ban_duration === 'none' ? null : new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 100);
        await sql`update auth.users set banned_until = ${until} where id = ${id}`;
      }
      if (typeof body.email === 'string') {
        await sql`update auth.users set email = ${body.email} where id = ${id}`;
      }
      const [user] = await sql`select id, email, email_confirmed_at from auth.users where id = ${id}`;
      return json(res, 200, userJson(user as never));
    }

    return authError(res, 404, 'not_found', `Unhandled auth route ${req.method} ${path}`);
  }

  async function handleStorage(req: IncomingMessage, res: ServerResponse, path: string) {
    const publicMatch = path.match(/^\/object\/(?:public|authenticated)\/([^/]+)\/(.+)$/);
    if (publicMatch && req.method === 'GET') {
      const object = objects.get(`${publicMatch[1]}/${decodeURIComponent(publicMatch[2]!)}`);
      if (!object) return json(res, 404, { statusCode: '404', error: 'not_found', message: 'Object not found' });
      res.writeHead(200, { 'content-type': object.contentType });
      res.end(object.body);
      return;
    }

    const signMatch = path.match(/^\/object\/sign\/([^/]+)\/(.+)$/);
    if (signMatch && req.method === 'POST') {
      await readBody(req);
      return json(res, 200, { signedURL: `/object/sign/${signMatch[1]}/${signMatch[2]}?token=fake` });
    }
    if (signMatch && req.method === 'GET') {
      const object = objects.get(`${signMatch[1]}/${decodeURIComponent(signMatch[2]!)}`);
      if (!object) return json(res, 404, { message: 'Object not found' });
      res.writeHead(200, { 'content-type': object.contentType });
      res.end(object.body);
      return;
    }

    if (req.headers.authorization !== `Bearer ${serviceKey}`) {
      return json(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'invalid signature' });
    }

    const objectMatch = path.match(/^\/object\/([^/]+)\/(.+)$/);
    if (objectMatch && (req.method === 'POST' || req.method === 'PUT')) {
      const key = `${objectMatch[1]}/${decodeURIComponent(objectMatch[2]!)}`;
      objects.set(key, {
        body: await readBody(req),
        contentType: req.headers['content-type'] ?? 'application/octet-stream',
      });
      return json(res, 200, { Id: randomUUID(), Key: key });
    }

    const bucketMatch = path.match(/^\/object\/([^/]+)$/);
    if (bucketMatch && req.method === 'DELETE') {
      const { prefixes } = JSON.parse((await readBody(req)).toString()) as { prefixes: string[] };
      for (const prefix of prefixes) objects.delete(`${bucketMatch[1]}/${prefix}`);
      return json(res, 200, prefixes.map((name) => ({ name })));
    }

    return json(res, 404, { message: `Unhandled storage route ${req.method} ${path}` });
  }

  const server: Server = createServer((req, res) => {
    const parsed = new URL(req.url ?? '/', url);
    const handle = async () => {
      // Stands in for clicking the link in the confirmation email.
      if (parsed.pathname === '/__dev/confirm' && req.method === 'POST') {
        await sql`update auth.users set email_confirmed_at = now() where email = ${parsed.searchParams.get('email')}`;
        return json(res, 200, { confirmed: true });
      }
      if (parsed.pathname.startsWith('/auth/v1')) {
        return handleAuth(req, res, parsed.pathname.slice('/auth/v1'.length), parsed.searchParams);
      }
      if (parsed.pathname.startsWith('/storage/v1')) {
        return handleStorage(req, res, parsed.pathname.slice('/storage/v1'.length));
      }
      return json(res, 404, { message: 'not found' });
    };
    handle().catch((error: unknown) => json(res, 500, { message: String(error) }));
  });

  await new Promise<void>((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));

  return {
    url,
    port,
    serviceKey,
    issueToken,
    sentEmails,
    storedObjects: () => [...objects.keys()],
    async confirmEmail(email) {
      await sql`update auth.users set email_confirmed_at = now() where email = ${email}`;
    },
    async stop() {
      await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
    },
  };
}
