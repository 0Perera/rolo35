import { apiFetch } from './client';

export type ResultadoSimulado = 'APROVADO' | 'RECUSADO';

export interface IngressoEmitido {
  id: string;
  assentoId: number;
  codigo: string;
  /** Código curto pra ditar na portaria quando a câmera não lê. */
  codigoCurto: string;
}

export interface Pagamento {
  status: 'CONFIRMADA' | 'RECUSADA';
  ingressos: IngressoEmitido[];
}

export interface ConfirmarPagamentoRequest {
  reservaId: number;
  resultadoSimulado: ResultadoSimulado;
}

/**
 * A assinatura é a garantia de que dado de cartão não sai da tela: não existe parâmetro onde nome,
 * número, validade ou CVV caibam. O formulário é fidelidade da simulação, não insumo da requisição.
 */
export function confirmarPagamento(request: ConfirmarPagamentoRequest): Promise<Pagamento> {
  return apiFetch<Pagamento>('/api/pagamentos/confirmar', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
