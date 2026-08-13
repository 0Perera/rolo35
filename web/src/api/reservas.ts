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

export interface AssentoReservado {
  id: number;
  fileira: string;
  numero: number;
}

/**
 * Reserva com o contexto necessário pra montar o checkout do zero. Mais larga que `Reserva` de
 * propósito: quem chega por um F5 na URL de pagamento não tem nada em mãos além do id.
 *
 * O contexto da sessão é nulo quando a reserva já foi recusada — os assentos voltaram a ficar
 * livres e não há mais linha de onde tirá-lo. Quem consome decide o que mostrar pelo `status`.
 */
export interface ReservaCheckout {
  id: number;
  sessaoId: number;
  status: 'ATIVA' | 'CONFIRMADA' | 'RECUSADA';
  expiresAt: string | null;
  sessaoTitulo: string | null;
  salaNome: string | null;
  dataHora: string | null;
  preco: number | null;
  assentos: AssentoReservado[];
}

export function reservarAssentos(request: ReservarAssentosRequest): Promise<Reserva> {
  return apiFetch<Reserva>('/api/reservas', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function buscarReserva(id: number): Promise<ReservaCheckout> {
  return apiFetch<ReservaCheckout>(`/api/reservas/${id}`);
}
