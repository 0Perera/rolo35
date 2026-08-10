import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ListagemSessoesPage } from './ListagemSessoesPage';
import * as sessoesApi from '../api/sessoes';
import type { SessaoPublicada } from '../api/sessoes';

const sessaoComVaga: SessaoPublicada = {
  id: 1,
  salaNome: 'Sala 1',
  tmdbId: 550,
  titulo: 'Clube da Luta',
  posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
  sinopse: 'Sinopse do filme',
  dataEstreia: '1999-10-15',
  dataHora: '2030-01-01T20:00:00',
  preco: 25.5,
  capacidade: 40,
  esgotada: false,
};

const sessaoEsgotada: SessaoPublicada = {
  ...sessaoComVaga,
  id: 2,
  titulo: 'Matrix',
  esgotada: true,
};

describe('ListagemSessoesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state while sessions are being fetched', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockReturnValue(new Promise(() => {}));

    render(<ListagemSessoesPage />);

    expect(await screen.findByText(/carregando sessões/i)).toBeInTheDocument();
  });

  it('shows an empty-list message when there are no sessions', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue([]);

    render(<ListagemSessoesPage />);

    expect(await screen.findByText(/nenhuma sessão disponível/i)).toBeInTheDocument();
  });

  it('shows an error message when sessions fail to load', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockRejectedValue(new Error('falha de rede'));

    render(<ListagemSessoesPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar as sessões/i);
  });

  it('lists sessions with vaga and esgotada, keeping the esgotada one visible', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue([sessaoComVaga, sessaoEsgotada]);

    render(<ListagemSessoesPage />);

    expect(await screen.findByText('Clube da Luta')).toBeInTheDocument();
    expect(screen.getByText('Matrix')).toBeInTheDocument();
    expect(screen.getByText('Esgotada')).toBeInTheDocument();
  });

  it('does not show the esgotada badge for a session with available seats', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue([sessaoComVaga]);

    render(<ListagemSessoesPage />);

    await screen.findByText('Clube da Luta');
    expect(screen.queryByText('Esgotada')).not.toBeInTheDocument();
  });

  it('retries loading the sessions when the retry button is clicked', async () => {
    const listarSpy = vi
      .spyOn(sessoesApi, 'listarSessoesPublicadas')
      .mockRejectedValueOnce(new Error('falha de rede'))
      .mockResolvedValueOnce([sessaoComVaga]);
    const user = userEvent.setup();

    render(<ListagemSessoesPage />);

    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));

    expect(await screen.findByText('Clube da Luta')).toBeInTheDocument();
    expect(listarSpy).toHaveBeenCalledTimes(2);
  });
});
