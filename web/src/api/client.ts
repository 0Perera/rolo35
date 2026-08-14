import { lerSessao, limparSessao } from '../lib/sessao';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

// Dimensionado pelo cold start medido, não chutado: a API roda no plano free do Render, que dorme
// após 15 min sem tráfego, e subir de novo leva 179s num container com as restrições reais desse
// plano (0.1 vCPU) — o startup do Spring Boot é quase todo CPU-bound e single-thread. Os 90s que
// este teto tinha antes ficavam abaixo disso, então o próprio cliente abortava a primeira chamada
// depois de cada soneca e a tela mostrava erro de rede numa API que estava subindo normalmente.
// 240s cobrem os 179s mais o tempo de o Render agendar o container. Esperar demais é ruim; inventar
// uma falha que não existe é pior, porque manda o usuário refazer o que não precisava (AD-2).
const REQUEST_TIMEOUT_MS = 240_000;

export class ApiRequestError extends Error {
  readonly status: number;
  /**
   * `codigo` do envelope de erro da API. Existe porque o status sozinho não basta: o mesmo `409`
   * cobre erro terminal (reserva expirada, refazer a seleção) e erro transitório (reserva em
   * disputa, tentar de novo), e tratar os dois igual manda o cliente refazer o que não precisava.
   */
  readonly codigo?: string;

  constructor(message: string, status: number, codigo?: string) {
    super(message);
    this.status = status;
    this.codigo = codigo;
  }
}

/**
 * Token que a API recusou. Distingue "sua sessão acabou, entre de novo" de "a API falhou, tente de
 * novo" — sem isso a tela pede pra repetir uma chamada que vai dar 401 de novo pra sempre.
 */
export class SessaoExpiradaError extends ApiRequestError {}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const { token } = lerSessao();

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
      const codigo =
        body !== null && typeof body === 'object' && 'codigo' in body && typeof body.codigo === 'string'
          ? body.codigo
          : undefined;
      // 401 só significa sessão morta se havia token pra morrer: o mesmo status responde
      // credencial errada no login, e limpar/anunciar sessão ali seria inventar um logout de
      // quem nunca entrou.
      if (response.status === 401 && token) {
        limparSessao();
        throw new SessaoExpiradaError(mensagem, response.status, codigo);
      }
      throw new ApiRequestError(mensagem, response.status, codigo);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}
