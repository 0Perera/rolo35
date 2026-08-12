import { apiFetch } from './client';

export interface ReservarAssentosRequest {
  sessaoId: number;
  assentoIds: number[];
}

export interface Reserva {
  id: number;
  sessaoId: number;
  status: 'ATIVA' | 'CONFIRMADA' | 'RECUSADA';
  expiresAt: string;
  assentoIds: number[];
}

export function reservarAssentos(request: ReservarAssentosRequest): Promise<Reserva> {
  return apiFetch<Reserva>('/api/reservas', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
