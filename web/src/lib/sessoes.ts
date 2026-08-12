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

export function precoMinimo(sessoes: SessaoPublicada[]): string {
  const menor = Math.min(...sessoes.map((sessao) => sessao.preco));
  return `R$ ${menor.toFixed(2).replace('.', ',')}`;
}

/** Nome da sala quando só existe uma; "N SALAS" quando o filme passa em mais de uma. */
export function resumoDeSalas(sessoes: SessaoPublicada[]): string {
  const salas = new Set(sessoes.map((sessao) => sessao.salaNome));
  return salas.size === 1 ? [...salas][0].toUpperCase() : `${salas.size} SALAS`;
}

export function contagemDeSessoes(total: number): string {
  return `${total} ${total === 1 ? 'SESSÃO' : 'SESSÕES'}`;
}
