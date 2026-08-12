import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MapaAssentosPage } from './MapaAssentosPage';
import * as sessoesApi from '../api/sessoes';
import { ApiRequestError } from '../api/client';
import type { MapaAssentos } from '../api/sessoes';

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
      </Routes>
    </MemoryRouter>,
  );
}

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
});
