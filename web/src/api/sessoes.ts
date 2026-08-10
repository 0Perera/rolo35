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

export function listarSalas(): Promise<Sala[]> {
  return apiFetch<Sala[]>('/api/salas');
}

export function criarSessao(request: CriarSessaoRequest): Promise<Sessao> {
  return apiFetch<Sessao>('/api/sessoes', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
