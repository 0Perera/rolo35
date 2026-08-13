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

export function listarSessoesPublicadas(): Promise<SessaoPublicada[]> {
  return apiFetch<SessaoPublicada[]>('/api/sessoes');
}

export function listarMinhasSessoes(): Promise<SessaoGestao[]> {
  return apiFetch<SessaoGestao[]>('/api/sessoes/minhas');
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
