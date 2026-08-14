import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ApiRequestError, SessaoExpiradaError, apiFetch } from './client';

function respostaDeErro(body: unknown, status = 409): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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

  it('exposes the codigo of the error envelope alongside status and message', async () => {
    vi.mocked(fetch).mockResolvedValue(
      respostaDeErro({ codigo: 'RESERVA_EXPIRADA', mensagem: 'Reserva expirada' }),
    );

    const erro = await apiFetch('/api/pagamentos/confirmar').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ApiRequestError);
    expect((erro as ApiRequestError).codigo).toBe('RESERVA_EXPIRADA');
    expect((erro as ApiRequestError).status).toBe(409);
    expect((erro as ApiRequestError).message).toBe('Reserva expirada');
  });

  it('leaves codigo undefined when the error body has none', async () => {
    vi.mocked(fetch).mockResolvedValue(respostaDeErro({ mensagem: 'Erro qualquer' }, 500));

    const erro = await apiFetch('/api/qualquer').catch((e: unknown) => e);

    expect((erro as ApiRequestError).codigo).toBeUndefined();
    expect((erro as ApiRequestError).message).toBe('Erro qualquer');
  });

  it('clears the stored session when the API rejects the token we sent', async () => {
    localStorage.setItem('rolo35.token', 'token-vencido');
    localStorage.setItem('rolo35.papel', 'CLIENTE');
    vi.mocked(fetch).mockResolvedValue(respostaDeErro({ mensagem: 'Não autenticado' }, 401));

    const erro = await apiFetch('/api/ingressos/minhas').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(SessaoExpiradaError);
    expect(localStorage.getItem('rolo35.token')).toBeNull();
    expect(localStorage.getItem('rolo35.papel')).toBeNull();
  });

  it('does not report an expired session on a 401 from a request that carried no token', async () => {
    vi.mocked(fetch).mockResolvedValue(
      respostaDeErro({ codigo: 'CREDENCIAIS_INVALIDAS', mensagem: 'E-mail ou senha inválidos' }, 401),
    );

    const erro = await apiFetch('/api/auth/login', { method: 'POST' }).catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ApiRequestError);
    expect(erro).not.toBeInstanceOf(SessaoExpiradaError);
    expect((erro as ApiRequestError).codigo).toBe('CREDENCIAIS_INVALIDAS');
  });

  it('leaves codigo undefined when the error body is not JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('<html>502</html>', { status: 502, headers: { 'Content-Type': 'text/html' } }),
    );

    const erro = await apiFetch('/api/qualquer').catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ApiRequestError);
    expect((erro as ApiRequestError).codigo).toBeUndefined();
    expect((erro as ApiRequestError).status).toBe(502);
  });
});
