import { useSyncExternalStore } from 'react';
import type { Papel } from '../api/auth';

const CHAVE_TOKEN = 'rolo35.token';
const CHAVE_PAPEL = 'rolo35.papel';

export interface Sessao {
  token: string | null;
  papel: Papel | null;
}

/**
 * A sessão mora no `localStorage`, que não avisa ninguém dentro da própria aba quando muda (o
 * evento `storage` só cruza abas). Sem esses ouvintes, o header continuaria desenhando "CLIENTE ·
 * SAIR" depois de o `apiFetch` derrubar um token recusado pela API.
 */
const ouvintes = new Set<() => void>();

let snapshot: Sessao = { token: null, papel: null };

/**
 * `useSyncExternalStore` compara snapshots por identidade e entra em loop se cada leitura devolver
 * um objeto novo — daí o cache só ser trocado quando os valores mudam de fato. Reler o storage a
 * cada chamada (em vez de confiar num valor guardado na notificação) mantém a leitura correta
 * mesmo quando alguém escreve direto no `localStorage`.
 */
function snapshotAtual(): Sessao {
  const token = localStorage.getItem(CHAVE_TOKEN);
  const papel = localStorage.getItem(CHAVE_PAPEL) as Papel | null;
  if (snapshot.token !== token || snapshot.papel !== papel) {
    snapshot = { token, papel };
  }
  return snapshot;
}

function notificar(): void {
  for (const ouvinte of ouvintes) {
    ouvinte();
  }
}

export function lerSessao(): Sessao {
  return snapshotAtual();
}

export function salvarSessao(token: string, papel: Papel): void {
  localStorage.setItem(CHAVE_TOKEN, token);
  localStorage.setItem(CHAVE_PAPEL, papel);
  notificar();
}

export function limparSessao(): void {
  localStorage.removeItem(CHAVE_TOKEN);
  localStorage.removeItem(CHAVE_PAPEL);
  notificar();
}

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** Sessão corrente, re-renderizando quem usa sempre que ela é salva ou derrubada. */
export function useSessao(): Sessao {
  return useSyncExternalStore(assinar, snapshotAtual);
}
