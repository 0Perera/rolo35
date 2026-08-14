import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MapaAssentosPage } from './MapaAssentosPage';
import * as sessoesApi from '../api/sessoes';
import * as reservasApi from '../api/reservas';
import { ApiRequestError } from '../api/client';
import type { MapaAssentos } from '../api/sessoes';
import type { Reserva } from '../api/reservas';

const mapa: MapaAssentos = {
  sessaoId: 5,
  tmdbId: 550,
  titulo: 'Clube da Luta',
  posterUrl: null,
  salaNome: 'Sala 1',
  dataHora: '2030-01-01T20:00:00',
  preco: 25,
  assentos: [
    { id: 1, fileira: 'A', numero: 1, status: 'LIVRE' },
    { id: 2, fileira: 'A', numero: 2, status: 'RESERVADO' },
    { id: 3, fileira: 'B', numero: 1, status: 'VENDIDO' },
  ],
};

function PaginaDePagamentoFalsa() {
  const { reservaId } = useParams<{ reservaId: string }>();
  return <p>página de pagamento da reserva {reservaId}</p>;
}

/** Espelha o que o mapa mandou pro login: pra onde voltar e quais assentos preservar. */
function PaginaDeLoginFalsa() {
  const { state } = useLocation() as { state: { retomarEm?: string; assentoIds?: number[] } | null };
  return (
    <p>
      login pra retomar {state?.retomarEm} com assentos {(state?.assentoIds ?? []).join(',')}
    </p>
  );
}

function renderPage(id = '5') {
  return render(
    <MemoryRouter initialEntries={[`/sessoes/${id}/assentos`]}>
      <Routes>
        <Route path="/sessoes/:id/assentos" element={<MapaAssentosPage />} />
        <Route path="/pagamento/:reservaId" element={<PaginaDePagamentoFalsa />} />
        <Route path="/login" element={<PaginaDeLoginFalsa />} />
      </Routes>
    </MemoryRouter>,
  );
}

const mapaComSeisLivres: MapaAssentos = {
  ...mapa,
  assentos: [
    { id: 1, fileira: 'A', numero: 1, status: 'LIVRE' },
    { id: 2, fileira: 'A', numero: 2, status: 'LIVRE' },
    { id: 3, fileira: 'A', numero: 3, status: 'LIVRE' },
    { id: 4, fileira: 'A', numero: 4, status: 'LIVRE' },
    { id: 5, fileira: 'A', numero: 5, status: 'LIVRE' },
    { id: 6, fileira: 'A', numero: 6, status: 'LIVRE' },
    { id: 7, fileira: 'A', numero: 7, status: 'LIVRE' },
  ],
};

function entrarComo(papel: string) {
  localStorage.setItem('rolo35.token', 'token-abc');
  localStorage.setItem('rolo35.papel', papel);
}

describe('MapaAssentosPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('shows a loading state while the map is being fetched', () => {
    vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('shows a generic error message for a non-404 failure', async () => {
    vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockRejectedValue(new Error('falha de rede'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i);
  });

  it('shows a not-found message when the session does not exist', async () => {
    vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockRejectedValue(new ApiRequestError('não encontrada', 404));

    renderPage('999');

    expect(await screen.findByRole('alert')).toHaveTextContent(/sessão não encontrada/i);
  });

  // Quem chega no mapa veio da tela de horários do filme; devolver pra vitrine inteira obriga a
  // procurar o filme de novo pra trocar de sessão.
  it('points the back link at the film, not at the whole shelf', async () => {
    vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockResolvedValue(mapa);

    renderPage();

    expect(await screen.findByRole('link', { name: /voltar/i })).toHaveAttribute('href', '/filmes/550');
  });

  it('renders the session header and each seat with its status', async () => {
    vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockResolvedValue(mapa);

    renderPage();

    expect(await screen.findByText('Clube da Luta')).toBeInTheDocument();
    expect(screen.getByText(/sala 1/i)).toBeInTheDocument();

    expect(screen.getByLabelText('Assento A1 — livre')).toHaveAttribute('data-status', 'LIVRE');
    expect(screen.getByLabelText('Assento A2 — reservado')).toHaveAttribute('data-status', 'RESERVADO');
    expect(screen.getByLabelText('Assento B1 — vendido')).toHaveAttribute('data-status', 'VENDIDO');
  });

  it('exposes a tooltip with the seat state and blocks clicks on taken seats', async () => {
    vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockResolvedValue(mapa);
    const user = userEvent.setup();

    renderPage();
    const reservado = await screen.findByLabelText('Assento A2 — reservado');
    const vendido = screen.getByLabelText('Assento B1 — vendido');

    expect(screen.getByLabelText('Assento A1 — livre')).toHaveAttribute('title', 'Assento A1 — livre');
    expect(reservado).toHaveAttribute('title', 'Assento A2 — reservado');
    expect(reservado).toBeDisabled();
    expect(vendido).toBeDisabled();

    await user.click(reservado);
    await user.click(vendido);

    expect(reservado).toHaveAttribute('aria-pressed', 'false');
    expect(vendido).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /ir para o pagamento/i })).toBeDisabled();
  });

  it('selects and deselects a free seat on click, enabling the confirm button only with a selection', async () => {
    vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockResolvedValue(mapa);
    const user = userEvent.setup();

    renderPage();
    const assentoLivre = await screen.findByLabelText('Assento A1 — livre');
    const botaoReservar = screen.getByRole('button', { name: /ir para o pagamento/i });

    expect(botaoReservar).toBeDisabled();

    await user.click(assentoLivre);
    expect(assentoLivre).toHaveAttribute('aria-pressed', 'true');
    expect(botaoReservar).toBeEnabled();

    await user.click(assentoLivre);
    expect(assentoLivre).toHaveAttribute('aria-pressed', 'false');
    expect(botaoReservar).toBeDisabled();
  });

  it('summarises the order, listing the chosen seats and the running total', async () => {
    vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockResolvedValue(mapaComSeisLivres);
    const user = userEvent.setup();

    renderPage();
    await screen.findByLabelText('Assento A1 — livre');

    expect(screen.getByText(/nenhum assento escolhido/i)).toBeInTheDocument();
    expect(screen.getByText('R$ 0,00')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Assento A1 — livre'));
    await user.click(screen.getByLabelText('Assento A2 — livre'));

    expect(screen.getByText('A1')).toBeInTheDocument();
    expect(screen.getByText('A2')).toBeInTheDocument();
    expect(screen.queryByText(/nenhum assento escolhido/i)).not.toBeInTheDocument();
    expect(screen.getByText('R$ 50,00')).toBeInTheDocument();
  });

  it('does not select a seventh seat once six are already selected', async () => {
    vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockResolvedValue(mapaComSeisLivres);
    const user = userEvent.setup();

    renderPage();
    await screen.findByLabelText('Assento A1 — livre');

    for (let numero = 1; numero <= 6; numero += 1) {
      await user.click(screen.getByLabelText(`Assento A${numero} — livre`));
    }
    const setimo = screen.getByLabelText('Assento A7 — livre');
    await user.click(setimo);

    expect(setimo).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/máximo de 6 assentos/i)).toBeInTheDocument();
  });

  it('reserves the selected seats and goes to the checkout of the created reserva', async () => {
    vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockResolvedValue(mapa);
    const reserva: Reserva = {
      id: 77,
      sessaoId: 5,
      status: 'ATIVA',
      expiresAt: '2030-01-01T20:10:00',
      assentoIds: [1],
    };
    const reservarSpy = vi.spyOn(reservasApi, 'reservarAssentos').mockResolvedValue(reserva);
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByLabelText('Assento A1 — livre'));
    await user.click(screen.getByRole('button', { name: /ir para o pagamento/i }));

    await waitFor(() => {
      expect(reservarSpy).toHaveBeenCalledWith({ sessaoId: 5, assentoIds: [1] });
    });
    expect(await screen.findByText('página de pagamento da reserva 77')).toBeInTheDocument();
  });

  it('shows an error and reloads the map, clearing the selection, on a 409 conflict', async () => {
    const buscarSpy = vi
      .spyOn(sessoesApi, 'buscarMapaAssentos')
      .mockResolvedValueOnce(mapa)
      .mockResolvedValueOnce({
        ...mapa,
        assentos: [
          { id: 1, fileira: 'A', numero: 1, status: 'RESERVADO' },
          { id: 2, fileira: 'A', numero: 2, status: 'RESERVADO' },
          { id: 3, fileira: 'B', numero: 1, status: 'VENDIDO' },
        ],
      });
    vi.spyOn(reservasApi, 'reservarAssentos').mockRejectedValue(new ApiRequestError('indisponível', 409));
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByLabelText('Assento A1 — livre'));
    await user.click(screen.getByRole('button', { name: /ir para o pagamento/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/não estão mais disponíveis/i);
    await waitFor(() => expect(buscarSpy).toHaveBeenCalledTimes(2));
    expect(await screen.findByLabelText('Assento A1 — reservado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ir para o pagamento/i })).toBeDisabled();
  });

  // "O mapa foi atualizado" é a mensagem certa pra assento tomado e errada pra sessão encerrada:
  // ali recarregar resolve, aqui não resolve nunca. E como não resolve, a tela precisa virar
  // terminal de verdade — deixar a grade e o botão no ar é convidar a pessoa a repetir uma chamada
  // que nunca pode dar certo, dizendo "escolha outra sessão" sem oferecer por onde.
  it('turns the seat map into a terminal screen with a way out on a 409 SESSAO_JA_COMECOU', async () => {
    const buscarSpy = vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockResolvedValue(mapa);
    vi.spyOn(reservasApi, 'reservarAssentos').mockRejectedValue(
      new ApiRequestError('Sessão já começou', 409, 'SESSAO_JA_COMECOU'),
    );
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByLabelText('Assento A1 — livre'));
    await user.click(screen.getByRole('button', { name: /ir para o pagamento/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/sessão já começou/i);
    expect(buscarSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /ir para o pagamento/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Assento A1 — livre')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /escolher outra sessão/i })).toBeInTheDocument();
  });

  it('sends the visitor to the login screen with the pending purchase on a 401', async () => {
    vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockResolvedValue(mapaComSeisLivres);
    const reservarSpy = vi
      .spyOn(reservasApi, 'reservarAssentos')
      .mockRejectedValue(new ApiRequestError('não autenticado', 401));
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByLabelText('Assento A1 — livre'));
    await user.click(screen.getByLabelText('Assento A2 — livre'));
    await user.click(screen.getByRole('button', { name: /ir para o pagamento/i }));

    expect(await screen.findByText('login pra retomar /sessoes/5/assentos com assentos 1,2')).toBeInTheDocument();
    expect(reservarSpy).toHaveBeenCalledTimes(1);
  });

  // Quem já está logado com o papel errado não tem o que fazer no login: a credencial é a mesma e a
  // compra continuaria barrada. O aviso fica na tela, com a seleção intacta.
  it.each(['ORGANIZADOR', 'PORTARIA'])(
    'tells a logged-in %s to use a client account instead of bouncing to the login',
    async (papel) => {
      entrarComo(papel);
      vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockResolvedValue(mapa);
      const reservarSpy = vi.spyOn(reservasApi, 'reservarAssentos');
      const user = userEvent.setup();

      renderPage();
      const assento = await screen.findByLabelText('Assento A1 — livre');
      await user.click(assento);
      await user.click(screen.getByRole('button', { name: /ir para o pagamento/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent(/conta de cliente/i);
      expect(screen.queryByText(/login pra retomar/i)).not.toBeInTheDocument();
      // Nem chega a sair requisição: o 403 é certo, e a resposta não acrescenta nada ao aviso.
      expect(reservarSpy).not.toHaveBeenCalled();
      expect(assento).toHaveAttribute('aria-pressed', 'true');
    },
  );

  // Rede de segurança pro papel que o front acha que é CLIENTE mas a API recusa (token de outro
  // papel, storage adulterado): mesmo aviso, não um desvio calado pro login.
  it('shows the client-account warning, not the login screen, on a 403 from the API', async () => {
    entrarComo('CLIENTE');
    vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockResolvedValue(mapa);
    vi.spyOn(reservasApi, 'reservarAssentos').mockRejectedValue(new ApiRequestError('acesso negado', 403));
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByLabelText('Assento A1 — livre'));
    await user.click(screen.getByRole('button', { name: /ir para o pagamento/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/conta de cliente/i);
    expect(screen.queryByText(/login pra retomar/i)).not.toBeInTheDocument();
  });

  it('restores the seats chosen before the login, dropping the ones taken meanwhile', async () => {
    // A2 saiu como RESERVADO no mapa que voltou do servidor: quem escolheu antes do login não
    // ganha prioridade sobre quem reservou de fato nesse meio-tempo.
    vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockResolvedValue(mapa);

    render(
      <MemoryRouter
        initialEntries={[{ pathname: '/sessoes/5/assentos', state: { assentoIds: [1, 2] } }]}
      >
        <Routes>
          <Route path="/sessoes/:id/assentos" element={<MapaAssentosPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('Assento A1 — livre')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Assento A2 — reservado')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('R$ 25,00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ir para o pagamento/i })).toBeEnabled();
  });
});
