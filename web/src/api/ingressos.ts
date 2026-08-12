import { apiFetch } from './client';

export interface IngressoResumo {
  id: string;
  status: 'VALIDO' | 'UTILIZADO';
  assentoFileira: string;
  assentoNumero: number;
  sessaoTitulo: string;
  sessaoPosterUrl: string | null;
  salaNome: string;
  dataHora: string;
  codigo: string;
}

export interface IngressoPublico {
  sessaoTitulo: string;
  salaNome: string;
  dataHora: string;
  status: 'VALIDO' | 'UTILIZADO';
}

export function listarMeusIngressos(): Promise<IngressoResumo[]> {
  return apiFetch<IngressoResumo[]>('/api/ingressos/minhas');
}

export function buscarIngressoPublico(codigo: string): Promise<IngressoPublico> {
  return apiFetch<IngressoPublico>(`/api/ingressos/${codigo}`);
}
