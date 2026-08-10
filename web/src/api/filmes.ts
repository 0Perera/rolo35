import { apiFetch } from './client';

export interface Filme {
  tmdbId: number;
  titulo: string;
  posterUrl: string | null;
  sinopse: string;
  dataEstreia: string | null;
}

export function buscarFilmes(query: string): Promise<Filme[]> {
  return apiFetch<Filme[]>(`/api/filmes/buscar?query=${encodeURIComponent(query)}`);
}
