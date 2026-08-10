import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch } from './client';

describe('apiFetch', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('attaches the Authorization header when a token exists in localStorage', async () => {
    localStorage.setItem('rolo35.token', 'token-abc');

    await apiFetch('/api/qualquer');

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer token-abc');
  });

  it('does not attach the Authorization header when there is no token in localStorage', async () => {
    await apiFetch('/api/auth/login');

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.has('Authorization')).toBe(false);
  });
});
