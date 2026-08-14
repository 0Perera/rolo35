import { ApiRequestError, apiFetch } from './client';

export interface SessaoAtiva {
  sessaoId: number;
  titulo: string;
  salaNome: string;
  dataHora: string;
}

export interface ResultadoValidacao {
  resultado: 'VALIDO' | 'INVALIDO' | 'JA_UTILIZADO' | 'EVENTO_ERRADO';
  assentoFileira: string | null;
  assentoNumero: number | null;
  sessaoTitulo: string | null;
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

export interface LeituraTurno {
  /** Prefixo pra conferência visual. O código assinado inteiro nunca sai do servidor por aqui. */
  codigoCurto: string;
  assentoFileira: string;
  assentoNumero: number;
  validadoEm: string;
}

export interface PainelTurno {
  validados: number;
  /** Ingressos emitidos pra sessão — o denominador honesto, não a capacidade da sala. */
  emitidos: number;
  leituras: LeituraTurno[];
}

export function buscarPainelTurno(): Promise<PainelTurno> {
  return apiFetch<PainelTurno>('/api/portaria/turno/painel');
}

export function validarIngresso(codigo: string): Promise<ResultadoValidacao> {
  return apiFetch<ResultadoValidacao>('/api/portaria/validacoes', {
    method: 'POST',
    body: JSON.stringify({ codigo }),
  });
}
