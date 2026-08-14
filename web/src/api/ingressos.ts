import { apiFetch } from './client';
import type { Pagina } from './sessoes';

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
  /** Código curto pra ditar na portaria quando a câmera não lê. */
  codigoCurto: string;
}

export interface IngressoPublico {
  sessaoTitulo: string;
  salaNome: string;
  dataHora: string;
  status: 'VALIDO' | 'UTILIZADO';
}

export interface ConsultaMeusIngressos {
  pagina?: number;
  tamanho?: number;
}

/** Mesmo envelope e mesmos parâmetros da vitrine — a carteira reusa o componente de paginação. */
export function listarMeusIngressos(consulta: ConsultaMeusIngressos = {}): Promise<Pagina<IngressoResumo>> {
  const parametros = new URLSearchParams();
  if (consulta.pagina !== undefined) {
    parametros.set('pagina', String(consulta.pagina));
  }
  if (consulta.tamanho !== undefined) {
    parametros.set('tamanho', String(consulta.tamanho));
  }
  const query = parametros.toString();
  return apiFetch<Pagina<IngressoResumo>>(`/api/ingressos/minhas${query ? `?${query}` : ''}`);
}

export function buscarIngressoPublico(codigo: string): Promise<IngressoPublico> {
  return apiFetch<IngressoPublico>(`/api/ingressos/${codigo}`);
}
