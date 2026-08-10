import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
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
});
