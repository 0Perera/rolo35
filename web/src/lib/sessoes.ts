import type { SessaoPublicada } from '../api/sessoes';

/** "QUI 13/08" — rótulo de dia no estilo do handoff (VT323, tudo em caixa alta, sem ponto). */
export function rotuloDeDia(dataHora: string): string {
  return new Date(dataHora)
    .toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    .replace(/\./g, '')
    .replace(',', '')
    .toUpperCase();
}

/** "20:30" */
export function rotuloDeHora(dataHora: string): string {
  return new Date(dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatarPreco(valor: number): string {
  return `R$ ${valor.toFixed(2).replace('.', ',')}`;
}

/**
 * Preço a mostrar pro filme inteiro. Cada sessão tem o seu (o organizador define por sessão),
 * então só faz sentido dizer "a partir de" quando os preços de fato divergem — com um valor
 * único isso viraria ruído em cima do próprio preço.
 */
export function precoDoFilme(sessoes: SessaoPublicada[]): { texto: string; aPartirDe: boolean } {
  const valores = sessoes.map((sessao) => sessao.preco);
  const menor = Math.min(...valores);
  return { texto: formatarPreco(menor), aPartirDe: new Set(valores).size > 1 };
}

/** Nome da sala quando só existe uma; "N SALAS" quando o filme passa em mais de uma. */
export function resumoDeSalas(sessoes: SessaoPublicada[]): string {
  const salas = new Set(sessoes.map((sessao) => sessao.salaNome));
  return salas.size === 1 ? [...salas][0].toUpperCase() : `${salas.size} SALAS`;
}

export function contagemDeSessoes(total: number): string {
  return `${total} ${total === 1 ? 'SESSÃO' : 'SESSÕES'}`;
}

/** Um filme da vitrine, com todos os horários dele em cartaz. */
export interface FilmeAgrupado {
  tmdbId: number;
  titulo: string;
  posterUrl: string | null;
  dataEstreia: string | null;
  sessoes: SessaoPublicada[];
}

/**
 * A API devolve uma linha por sessão; a vitrine mostra um card por filme. O snapshot do TMDb
 * (título, pôster, estreia) se repete em todas as sessões do mesmo filme, então vale a primeira.
 */
export function agruparPorFilme(sessoes: SessaoPublicada[]): FilmeAgrupado[] {
  const porFilme = new Map<number, FilmeAgrupado>();

  for (const sessao of sessoes) {
    const existente = porFilme.get(sessao.tmdbId);
    if (existente) {
      existente.sessoes.push(sessao);
    } else {
      porFilme.set(sessao.tmdbId, {
        tmdbId: sessao.tmdbId,
        titulo: sessao.titulo,
        posterUrl: sessao.posterUrl,
        dataEstreia: sessao.dataEstreia,
        sessoes: [sessao],
      });
    }
  }

  for (const filme of porFilme.values()) {
    filme.sessoes.sort((a, b) => a.dataHora.localeCompare(b.dataHora));
  }

  return Array.from(porFilme.values());
}
