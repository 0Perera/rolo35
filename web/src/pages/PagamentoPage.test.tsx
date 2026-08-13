import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { PagamentoPage } from './PagamentoPage';
import * as pagamentosApi from '../api/pagamentos';
import * as reservasApi from '../api/reservas';
import { ApiRequestError } from '../api/client';
import type { Pagamento } from '../api/pagamentos';
import type { ReservaCheckout } from '../api/reservas';

/** `expiresAt` vem do servidor como LocalDateTime, sem fuso — o mesmo formato aqui. */
function daquiAMinutos(minutos: number): string {
  const instante = new Date(Date.now() + minutos * 60_000);
  return new Date(instante.getTime() - instante.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
}

const reservaAtiva: ReservaCheckout = {
  id: 7,
  sessaoId: 5,
  status: 'ATIVA',
  expiresAt: daquiAMinutos(10),
  sessaoTitulo: 'Clube da Luta',
  salaNome: 'Sala 1',
  dataHora: '2030-01-01T20:00:00',
  preco: 25,
  assentos: [
    { id: 1, fileira: 'A', numero: 1 },
    { id: 2, fileira: 'A', numero: 2 },
  ],
};

const pagamentoAprovado: Pagamento = {
  status: 'CONFIRMADA',
  ingressos: [
    { id: 'u-1', assentoId: 1, codigo: 'aaaa-1111.assinatura1' },
    { id: 'u-2', assentoId: 2, codigo: 'bbbb-2222.assinatura2' },
  ],
};

function renderPage(reservaId = '7') {
  return render(
    <MemoryRouter initialEntries={[`/pagamento/${reservaId}`]}>
      <Routes>
        <Route path="/pagamento/:reservaId" element={<PagamentoPage />} />
        <Route path="/meus-ingressos" element={<p>página meus ingressos</p>} />
        <Route path="/sessoes/:id/assentos" element={<p>página do mapa</p>} />
        <Route path="/" element={<p>página da vitrine</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function preencherCartao(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/nome no cartão/i), 'Fulano de Tal');
  await user.type(screen.getByLabelText(/número do cartão/i), '4111111111111111');
  await user.type(screen.getByLabelText(/validade/i), '12/30');
  await user.type(screen.getByLabelText(/cvv/i), '123');
}

describe('PagamentoPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rebuilds the whole screen from the URL, with no navigation state', async () => {
    vi.spyOn(reservasApi, 'buscarReserva').mockResolvedValue(reservaAtiva);

    renderPage();

    expect(await screen.findByText('Clube da Luta')).toBeInTheDocument();
    expect(screen.getByText(/sala 1/i)).toBeInTheDocument();
    expect(screen.getByText(/20:00/)).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('A2')).toBeInTheDocument();
    expect(screen.getByText('R$ 50,00')).toBeInTheDocument();
  });

  it('shows an access denied message and no form when the reserva is not the clients', async () => {
    vi.spyOn(reservasApi, 'buscarReserva').mockRejectedValue(new ApiRequestError('não autorizado', 403));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/não é sua|não tem permissão/i);
    expect(screen.queryByLabelText(/número do cartão/i)).not.toBeInTheDocument();
  });

  it('sends only reservaId and resultadoSimulado, then renders one ticket per issued ingresso', async () => {
    vi.spyOn(reservasApi, 'buscarReserva').mockResolvedValue(reservaAtiva);
    const confirmarSpy = vi.spyOn(pagamentosApi, 'confirmarPagamento').mockResolvedValue(pagamentoAprovado);
    const user = userEvent.setup();

    renderPage();
    await preencherCartao(user);
    await user.click(screen.getByRole('button', { name: /aprovar/i }));
    await user.click(screen.getByRole('button', { name: /confirmar pagamento/i }));

    await waitFor(() => {
      expect(confirmarSpy).toHaveBeenCalledWith({ reservaId: 7, resultadoSimulado: 'APROVADO' });
    });
    expect(await screen.findByText(/ticket na mão/i)).toBeInTheDocument();
    expect(screen.getAllByText(/escaneie na portaria/i)).toHaveLength(2);
    // `CÓDIGO ` no padrão: o código sozinho casaria também com o title do SVG do QR, que carrega a
    // URL pública — e aí o teste passaria sem o canhoto mostrar código nenhum.
    expect(screen.getByText(/CÓDIGO aaaa-1111\.assinatura1/)).toBeInTheDocument();
    expect(screen.getByText(/CÓDIGO bbbb-2222\.assinatura2/)).toBeInTheDocument();
  });

  it('renders the refusal screen and no ticket when the simulated result is RECUSADO', async () => {
    vi.spyOn(reservasApi, 'buscarReserva').mockResolvedValue(reservaAtiva);
    const confirmarSpy = vi
      .spyOn(pagamentosApi, 'confirmarPagamento')
      .mockResolvedValue({ status: 'RECUSADA', ingressos: [] });
    const user = userEvent.setup();

    renderPage();
    await preencherCartao(user);
    await user.click(screen.getByRole('button', { name: /recusar/i }));
    await user.click(screen.getByRole('button', { name: /confirmar pagamento/i }));

    await waitFor(() => {
      expect(confirmarSpy).toHaveBeenCalledWith({ reservaId: 7, resultadoSimulado: 'RECUSADO' });
    });
    expect(await screen.findByText(/pagamento recusado/i)).toBeInTheDocument();
    expect(screen.queryByText(/escaneie na portaria/i)).not.toBeInTheDocument();
  });

  it('does not send anything while the card form is incomplete', async () => {
    vi.spyOn(reservasApi, 'buscarReserva').mockResolvedValue(reservaAtiva);
    const confirmarSpy = vi.spyOn(pagamentosApi, 'confirmarPagamento').mockResolvedValue(pagamentoAprovado);
    const user = userEvent.setup();

    renderPage();
    await user.type(await screen.findByLabelText(/nome no cartão/i), 'Fulano de Tal');
    await user.click(screen.getByRole('button', { name: /confirmar pagamento/i }));

    expect(confirmarSpy).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toHaveTextContent(/preencha/i);
  });

  it('treats a 409 RESERVA_EXPIRADA as terminal, pointing back to the seat map', async () => {
    vi.spyOn(reservasApi, 'buscarReserva').mockResolvedValue(reservaAtiva);
    vi.spyOn(pagamentosApi, 'confirmarPagamento').mockRejectedValue(
      new ApiRequestError('Reserva expirada', 409, 'RESERVA_EXPIRADA'),
    );
    const user = userEvent.setup();

    renderPage();
    await preencherCartao(user);
    await user.click(screen.getByRole('button', { name: /confirmar pagamento/i }));

    expect(await screen.findByText(/reserva expirou/i)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /escolher assentos/i }));
    expect(await screen.findByText('página do mapa')).toBeInTheDocument();
  });

  it('treats a 409 RESERVA_EM_DISPUTA as retryable, keeping the confirm button usable', async () => {
    vi.spyOn(reservasApi, 'buscarReserva').mockResolvedValue(reservaAtiva);
    vi.spyOn(pagamentosApi, 'confirmarPagamento').mockRejectedValue(
      new ApiRequestError('Reserva em disputa', 409, 'RESERVA_EM_DISPUTA'),
    );
    const user = userEvent.setup();

    renderPage();
    await preencherCartao(user);
    await user.click(screen.getByRole('button', { name: /confirmar pagamento/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/tente novamente/i);
    expect(screen.queryByText(/reserva expirou/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmar pagamento/i })).toBeEnabled();
  });

  it('reaches the expired state without a round-trip when the countdown hits zero', async () => {
    // Timers falsos desde antes do mount: o contador é um setInterval criado na montagem, e
    // trocar o relógio depois deixaria o intervalo já agendado rodando no tempo real.
    vi.useFakeTimers();
    vi.spyOn(reservasApi, 'buscarReserva').mockResolvedValue({ ...reservaAtiva, expiresAt: daquiAMinutos(0.05) });
    const confirmarSpy = vi.spyOn(pagamentosApi, 'confirmarPagamento').mockResolvedValue(pagamentoAprovado);

    renderPage();
    await act(async () => {});
    expect(screen.getByText('Clube da Luta')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.getByText(/reserva expirou/i)).toBeInTheDocument();
    expect(confirmarSpy).not.toHaveBeenCalled();
  });

  it('redirects a CONFIRMADA reserva to the wallet instead of showing an error', async () => {
    vi.spyOn(reservasApi, 'buscarReserva').mockResolvedValue({ ...reservaAtiva, status: 'CONFIRMADA' });

    renderPage();

    expect(await screen.findByText('página meus ingressos')).toBeInTheDocument();
    expect(screen.queryByLabelText(/número do cartão/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders the refusal screen for a RECUSADA reserva with no seats left', async () => {
    vi.spyOn(reservasApi, 'buscarReserva').mockResolvedValue({
      ...reservaAtiva,
      status: 'RECUSADA',
      expiresAt: null,
      sessaoTitulo: null,
      salaNome: null,
      dataHora: null,
      preco: null,
      assentos: [],
    });

    renderPage();

    expect(await screen.findByText(/pagamento recusado/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/número do cartão/i)).not.toBeInTheDocument();
  });
});
