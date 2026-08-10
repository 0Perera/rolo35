const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

// Cold start do plano free do Render leva ~1min; timeout com folga evita
// confundir isso com erro de rede (AD-2).
const REQUEST_TIMEOUT_MS = 90_000;

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const token = localStorage.getItem('rolo35.token');

  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const mensagem =
        body !== null && typeof body === 'object' && 'mensagem' in body && typeof body.mensagem === 'string'
          ? body.mensagem
          : 'Erro ao comunicar com o servidor';
      throw new ApiRequestError(mensagem, response.status);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}
