import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MapaAssentosPage } from './MapaAssentosPage';
import { PapelPlaceholderPage } from './PapelPlaceholderPage';
import * as sessoesApi from '../api/sessoes';
import * as reservasApi from '../api/reservas';
import { ApiRequestError } from '../api/client';
import type { MapaAssentos } from '../api/sessoes';
import type { Reserva } from '../api/reservas';

const mapa: MapaAssentos = {
  sessaoId: 5,
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

function renderPage(id = '5') {
  return render(
    <MemoryRouter initialEntries={[`/sessoes/${id}/assentos`]}>
      <Routes>
        <Route path="/sessoes/:id/assentos" element={<MapaAssentosPage />} />
        <Route path="/em-construcao" element={<PapelPlaceholderPage />} />
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

describe('MapaAssentosPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

  it('renders the session header and each seat with its status', async () => {
    vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockResolvedValue(mapa);

    renderPage();

    expect(await screen.findByText('Clube da Luta')).toBeInTheDocument();
    expect(screen.getByText(/sala 1/i)).toBeInTheDocument();

    expect(screen.getByLabelText('Assento A1 — livre')).toHaveAttribute('data-status', 'LIVRE');
    expect(screen.getByLabelText('Assento A2 — reservado')).toHaveAttribute('data-status', 'RESERVADO');
    expect(screen.getByLabelText('Assento B1 — vendido')).toHaveAttribute('data-status', 'VENDIDO');
  });

  it('selects and deselects a free seat on click, enabling the reservar button only with a selection', async () => {
    vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockResolvedValue(mapa);
    const user = userEvent.setup();

    renderPage();
    const assentoLivre = await screen.findByLabelText('Assento A1 — livre');
    const botaoReservar = screen.getByRole('button', { name: /reservar/i });

    expect(botaoReservar).toBeDisabled();

    await user.click(assentoLivre);
    expect(assentoLivre).toHaveAttribute('aria-pressed', 'true');
    expect(botaoReservar).toBeEnabled();

    await user.click(assentoLivre);
    expect(assentoLivre).toHaveAttribute('aria-pressed', 'false');
    expect(botaoReservar).toBeDisabled();
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

  it('reserves the selected seats and navigates on success', async () => {
    vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockResolvedValue(mapa);
    const reserva: Reserva = {
      id: 1,
      sessaoId: 5,
      status: 'ATIVA',
      expiresAt: '2030-01-01T20:10:00',
      assentoIds: [1],
    };
    const reservarSpy = vi.spyOn(reservasApi, 'reservarAssentos').mockResolvedValue(reserva);
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByLabelText('Assento A1 — livre'));
    await user.click(screen.getByRole('button', { name: /reservar/i }));

    await waitFor(() => {
      expect(reservarSpy).toHaveBeenCalledWith({ sessaoId: 5, assentoIds: [1] });
    });
    expect(await screen.findByText(/reserva confirmada/i)).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: /reservar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/não estão mais disponíveis/i);
    await waitFor(() => expect(buscarSpy).toHaveBeenCalledTimes(2));
    expect(await screen.findByLabelText('Assento A1 — reservado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reservar/i })).toBeDisabled();
  });

  it('shows a login message when the request is unauthorized', async () => {
    vi.spyOn(sessoesApi, 'buscarMapaAssentos').mockResolvedValue(mapa);
    vi.spyOn(reservasApi, 'reservarAssentos').mockRejectedValue(new ApiRequestError('não autenticado', 401));
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByLabelText('Assento A1 — livre'));
    await user.click(screen.getByRole('button', { name: /reservar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/faça login como cliente/i);
  });
});
