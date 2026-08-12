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
