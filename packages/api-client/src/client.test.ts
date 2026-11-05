import { describe, expect, it, vi } from 'vitest';
import { ApiClientError, createApiClient } from './index';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe('api client', () => {
  it('sends the bearer token and unwraps data', async () => {
    const fetchFn = vi.fn(async () => json(200, { data: { id: '1' } }));
    const client = createApiClient({ baseUrl: 'http://x/api/v1', getToken: () => 'abc', fetchFn: fetchFn as never });
    await expect(client.auth.me()).resolves.toEqual({ id: '1' });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://x/api/v1/auth/me');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer abc');
  });

  it('omits empty query values', async () => {
    const fetchFn = vi.fn(async () => json(200, { data: [], meta: {} }));
    const client = createApiClient({ baseUrl: '/bff', fetchFn: fetchFn as never });
    await client.listings.search({ q: 'อโศก', purpose: '', page: undefined, minPrice: 0 });
    const [url] = fetchFn.mock.calls[0] as unknown as [string];
    expect(url).toBe(`/bff/listings?q=${encodeURIComponent('อโศก')}&minPrice=0`);
  });

  it('turns API errors into typed errors', async () => {
    const fetchFn = vi.fn(async () => json(403, { error: { code: 'FORBIDDEN', message: 'ห้าม' } }));
    const client = createApiClient({ baseUrl: '/bff', fetchFn: fetchFn as never });
    const error = await client.auth.me().catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'ห้าม' });
  });

  it('refreshes once on 401 and retries', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(json(401, { error: { code: 'INVALID_TOKEN', message: 'x' } }))
      .mockResolvedValueOnce(json(200, { data: { ok: true } }));
    const refresh = vi.fn(async () => true);
    const client = createApiClient({ baseUrl: '/x', fetchFn, refresh });
    await expect(client.auth.me()).resolves.toEqual({ ok: true });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not loop when the retry is also unauthorized', async () => {
    const fetchFn = vi.fn(async () => json(401, { error: { code: 'INVALID_TOKEN', message: 'x' } }));
    const refresh = vi.fn(async () => true);
    const client = createApiClient({ baseUrl: '/x', fetchFn: fetchFn as never, refresh });
    await expect(client.auth.me()).rejects.toMatchObject({ status: 401 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('handles 204 responses', async () => {
    const fetchFn = vi.fn(async () => new Response(null, { status: 204 }));
    const client = createApiClient({ baseUrl: '/x', fetchFn: fetchFn as never });
    await expect(client.listings.favorite('1')).resolves.toBeUndefined();
  });
});
