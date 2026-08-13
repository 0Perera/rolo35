import { ApiRequestError, apiFetch } from './client';

export interface SessaoAtiva {
  sessaoId: number;
  titulo: string;
  salaNome: string;
  dataHora: string;
}

export function selecionarSessaoTurno(sessaoId: number): Promise<SessaoAtiva> {
  return apiFetch<SessaoAtiva>('/api/portaria/turno', {
    method: 'POST',
    body: JSON.stringify({ sessaoId }),
  });
}

export async function buscarSessaoAtiva(): Promise<SessaoAtiva | null> {
  try {
    return await apiFetch<SessaoAtiva>('/api/portaria/turno');
  } catch (erro) {
    if (erro instanceof ApiRequestError && erro.status === 409) {
      return null;
    }
    throw erro;
  }
}
