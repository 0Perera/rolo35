import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BuscaFilmesPage } from './BuscaFilmesPage';
import * as filmesApi from '../api/filmes';

function renderPage() {
  return render(
    <MemoryRouter>
      <BuscaFilmesPage />
    </MemoryRouter>,
  );
}

function SentinelaFilmeRecebido() {
  const location = useLocation();
  return <div data-testid="filme-recebido">{JSON.stringify(location.state)}</div>;
}

function renderPageComRotaDeCriarSessao() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<BuscaFilmesPage />} />
        <Route path="/organizador/sessoes/nova" element={<SentinelaFilmeRecebido />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BuscaFilmesPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('calls filmes.buscarFilmes with the typed term on submit and shows the results', async () => {
    vi.spyOn(filmesApi, 'buscarFilmes').mockResolvedValue([
      {
        tmdbId: 550,
        titulo: 'Clube da Luta',
        posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
        sinopse: 'Sinopse do filme',
        dataEstreia: '1999-10-15',
      },
    ]);
    const user = userEvent.setup();

    renderPage();

    await user.type(screen.getByPlaceholderText(/título do filme/i), 'clube');
    await user.click(screen.getByRole('button', { name: /buscar/i }));

    await waitFor(() => {
      expect(filmesApi.buscarFilmes).toHaveBeenCalledWith('clube');
    });
    expect(await screen.findByText('Clube da Luta')).toBeInTheDocument();
  });

  it('shows a loading state while the request is pending', async () => {
    let resolveBusca: (filmes: filmesApi.Filme[]) => void = () => {};
    vi.spyOn(filmesApi, 'buscarFilmes').mockReturnValue(
      new Promise((resolve) => {
        resolveBusca = resolve;
      }),
    );
    const user = userEvent.setup();

    renderPage();

    await user.type(screen.getByPlaceholderText(/título do filme/i), 'clube');
    await user.click(screen.getByRole('button', { name: /buscar/i }));

    expect(screen.getByRole('button', { name: /buscando/i })).toBeDisabled();

    resolveBusca([]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /buscar/i })).toBeEnabled();
    });
  });

  it('shows an empty-list message, not an error, when the search has no results', async () => {
    vi.spyOn(filmesApi, 'buscarFilmes').mockResolvedValue([]);
    const user = userEvent.setup();

    renderPage();

    await user.type(screen.getByPlaceholderText(/título do filme/i), 'filme-inexistente');
    await user.click(screen.getByRole('button', { name: /buscar/i }));

    expect(await screen.findByText(/nenhum filme encontrado/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a distinct error state when the search rejects', async () => {
    vi.spyOn(filmesApi, 'buscarFilmes').mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();

    renderPage();

    await user.type(screen.getByPlaceholderText(/título do filme/i), 'clube');
    await user.click(screen.getByRole('button', { name: /buscar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível buscar filmes/i);
    expect(screen.queryByText(/nenhum filme encontrado/i)).not.toBeInTheDocument();
  });

  it('clears results from a previous successful search when a later search fails', async () => {
    const buscarFilmesMock = vi.spyOn(filmesApi, 'buscarFilmes');
    buscarFilmesMock.mockResolvedValueOnce([
      {
        tmdbId: 550,
        titulo: 'Clube da Luta',
        posterUrl: null,
        sinopse: 'Sinopse do filme',
        dataEstreia: '1999-10-15',
      },
    ]);
    const user = userEvent.setup();

    renderPage();

    await user.type(screen.getByPlaceholderText(/título do filme/i), 'clube');
    await user.click(screen.getByRole('button', { name: /buscar/i }));
    expect(await screen.findByText('Clube da Luta')).toBeInTheDocument();

    buscarFilmesMock.mockRejectedValueOnce(new Error('falha de rede'));
    await user.clear(screen.getByPlaceholderText(/título do filme/i));
    await user.type(screen.getByPlaceholderText(/título do filme/i), 'outro filme');
    await user.click(screen.getByRole('button', { name: /buscar/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Clube da Luta')).not.toBeInTheDocument();
  });

  it('ignores a resubmit while a search is already in flight', async () => {
    let resolveBusca: (filmes: filmesApi.Filme[]) => void = () => {};
    const buscarFilmesMock = vi.spyOn(filmesApi, 'buscarFilmes').mockReturnValue(
      new Promise((resolve) => {
        resolveBusca = resolve;
      }),
    );
    const user = userEvent.setup();

    renderPage();

    const input = screen.getByPlaceholderText(/título do filme/i);
    await user.type(input, 'clube');
    await user.click(screen.getByRole('button', { name: /buscando|buscar/i }));
    await user.type(input, '{Enter}');

    resolveBusca([]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /buscar/i })).toBeEnabled();
    });
    expect(buscarFilmesMock).toHaveBeenCalledTimes(1);
  });

  it('navigates to the new-session page with the selected movie in route state when "Criar sessão" is clicked', async () => {
    vi.spyOn(filmesApi, 'buscarFilmes').mockResolvedValue([
      {
        tmdbId: 550,
        titulo: 'Clube da Luta',
        posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
        sinopse: 'Sinopse do filme',
        dataEstreia: '1999-10-15',
      },
    ]);
    const user = userEvent.setup();

    renderPageComRotaDeCriarSessao();

    await user.type(screen.getByPlaceholderText(/título do filme/i), 'clube');
    await user.click(screen.getByRole('button', { name: /buscar/i }));
    expect(await screen.findByText('Clube da Luta')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /criar sessão/i }));

    expect(await screen.findByTestId('filme-recebido')).toHaveTextContent('Clube da Luta');
  });
});
