import { apiFetch } from './client';

export interface Sala {
  id: number;
  nome: string;
  capacidade: number;
}

export interface Sessao {
  id: number;
  salaId: number;
  salaNome: string;
  tmdbId: number;
  titulo: string;
  posterUrl: string | null;
  sinopse: string | null;
  dataEstreia: string | null;
  dataHora: string;
  preco: number;
  capacidade: number;
  organizadorId: number;
}

export interface CriarSessaoRequest {
  salaId: number;
  tmdbId: number;
  titulo: string;
  posterUrl: string | null;
  sinopse: string | null;
  dataEstreia: string | null;
  dataHora: string;
  preco: number;
}

export interface SessaoPublicada {
  id: number;
  salaNome: string;
  tmdbId: number;
  titulo: string;
  posterUrl: string | null;
  sinopse: string | null;
  dataEstreia: string | null;
  dataHora: string;
  preco: number;
  capacidade: number;
  esgotada: boolean;
}

export interface SessaoGestao {
  id: number;
  salaId: number;
  salaNome: string;
  titulo: string;
  sinopse: string | null;
  dataHora: string;
  preco: number;
  capacidade: number;
  editavel: boolean;
}

export interface EditarSessaoRequest {
  salaId: number;
  titulo: string;
  sinopse: string | null;
  dataHora: string;
  preco: number;
}

export interface AssentoMapa {
  id: number;
  fileira: string;
  numero: number;
  status: 'LIVRE' | 'RESERVADO' | 'VENDIDO';
}

export interface MapaAssentos {
  sessaoId: number;
  tmdbId: number;
  titulo: string;
  posterUrl: string | null;
  salaNome: string;
  dataHora: string;
  preco: number;
  assentos: AssentoMapa[];
}

export function listarSalas(): Promise<Sala[]> {
  return apiFetch<Sala[]>('/api/salas');
}

export function criarSessao(request: CriarSessaoRequest): Promise<Sessao> {
  return apiFetch<Sessao>('/api/sessoes', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export interface Pagina<T> {
  conteudo: T[];
  pagina: number;
  tamanho: number;
  total: number;
  totalPaginas: number;
}

export interface ConsultaSessoes {
  /** Casa com título do filme, nome da sala e data/hora escrita como no Brasil ("14/08", "20:30"). */
  busca?: string;
  /** Filtra por filme. O detalhe do filme depende disto — sem ele só acharia o que caísse na página 1. */
  tmdbId?: number;
  /** Filtra por sala. */
  salaId?: number;
  pagina?: number;
  tamanho?: number;
}

export function listarSessoesPublicadas(consulta: ConsultaSessoes = {}): Promise<Pagina<SessaoPublicada>> {
  const parametros = new URLSearchParams();
  const busca = consulta.busca?.trim();
  if (busca) {
    parametros.set('q', busca);
  }
  if (consulta.tmdbId !== undefined) {
    parametros.set('tmdbId', String(consulta.tmdbId));
  }
  if (consulta.salaId !== undefined) {
    parametros.set('salaId', String(consulta.salaId));
  }
  if (consulta.pagina !== undefined) {
    parametros.set('pagina', String(consulta.pagina));
  }
  if (consulta.tamanho !== undefined) {
    parametros.set('tamanho', String(consulta.tamanho));
  }
  const query = parametros.toString();
  return apiFetch<Pagina<SessaoPublicada>>(`/api/sessoes${query ? `?${query}` : ''}`);
}

export interface OcupacaoSala {
  sessaoId: number;
  dataHora: string;
  /** Janela bloqueada, com o buffer de conflito já aplicado pelo back-end. */
  bloqueadoDe: string;
  bloqueadoAte: string;
}

/** Horários em que a sala não aceita sessão nova — só o intervalo, sem dizer de quem é cada sessão. */
export function listarOcupacaoDaSala(salaId: number): Promise<OcupacaoSala[]> {
  return apiFetch<OcupacaoSala[]>(`/api/sessoes/ocupacao?salaId=${salaId}`);
}

/**
 * Agenda do cinema inteiro: qualquer organizador gerencia qualquer sessão.
 *
 * Paginada pelo mesmo motivo que a vitrine — sem o recorte por dono que o CAP-1 removeu, esta
 * resposta é o histórico completo do cinema, crescendo indefinidamente com a agenda.
 */
export function listarSessoesParaGestao(pagina = 0): Promise<Pagina<SessaoGestao>> {
  return apiFetch<Pagina<SessaoGestao>>(`/api/sessoes/gestao?pagina=${pagina}`);
}

export function buscarSessao(id: number): Promise<SessaoGestao> {
  return apiFetch<SessaoGestao>(`/api/sessoes/${id}`);
}

export function editarSessao(id: number, request: EditarSessaoRequest): Promise<Sessao> {
  return apiFetch<Sessao>(`/api/sessoes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export function buscarMapaAssentos(id: number): Promise<MapaAssentos> {
  return apiFetch<MapaAssentos>(`/api/sessoes/${id}/mapa-assentos`);
}
