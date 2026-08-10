import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CriarSessaoPage } from './CriarSessaoPage';
import * as sessoesApi from '../api/sessoes';
import { ApiRequestError } from '../api/client';
import type { Filme } from '../api/filmes';

const filme: Filme = {
  tmdbId: 550,
  titulo: 'Clube da Luta',
  posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
  sinopse: 'Sinopse do filme',
  dataEstreia: '1999-10-15',
};

function renderPage(state: Filme | null = filme) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/organizador/sessoes/nova', state }]}>
      <CriarSessaoPage />
    </MemoryRouter>,
  );
}

describe('CriarSessaoPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a guard message and a link back to the search when no movie is in route state', () => {
    renderPage(null);

    expect(screen.getByText(/nenhum filme selecionado/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /busca de filmes/i })).toHaveAttribute('href', '/organizador');
  });

  it('shows a loading state while salas are being fetched', async () => {
    vi.spyOn(sessoesApi, 'listarSalas').mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(await screen.findByText(/carregando salas/i)).toBeInTheDocument();
  });

  it('shows an empty-list message when there are no salas', async () => {
    vi.spyOn(sessoesApi, 'listarSalas').mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText(/nenhuma sala cadastrada/i)).toBeInTheDocument();
  });

  it('shows an error message when salas fail to load', async () => {
    vi.spyOn(sessoesApi, 'listarSalas').mockRejectedValue(new Error('falha de rede'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar as salas/i);
  });

  it('submits the movie snapshot combined with the form fields to criarSessao', async () => {
    vi.spyOn(sessoesApi, 'listarSalas').mockResolvedValue([{ id: 1, nome: 'Sala 1', capacidade: 40 }]);
    const criarSessaoSpy = vi.spyOn(sessoesApi, 'criarSessao').mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    renderPage();

    await screen.findByRole('combobox');
    await user.selectOptions(screen.getByRole('combobox'), '1');
    const [dataHoraInput, precoInput] = screen.getAllByLabelText(/data e hora|preço/i);
    await user.type(dataHoraInput, '2030-01-01T20:00');
    await user.type(precoInput, '25.50');
    await user.click(screen.getByRole('button', { name: /criar sessão/i }));

    await waitFor(() => {
      expect(criarSessaoSpy).toHaveBeenCalledWith({
        salaId: 1,
        tmdbId: 550,
        titulo: 'Clube da Luta',
        posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
        sinopse: 'Sinopse do filme',
        dataEstreia: '1999-10-15',
        dataHora: '2030-01-01T20:00:00',
        preco: 25.5,
      });
    });
  });

  it('shows a success confirmation with a link back to the search after a successful submit', async () => {
    vi.spyOn(sessoesApi, 'listarSalas').mockResolvedValue([{ id: 1, nome: 'Sala 1', capacidade: 40 }]);
    vi.spyOn(sessoesApi, 'criarSessao').mockResolvedValue({
      id: 100,
      salaId: 1,
      salaNome: 'Sala 1',
      tmdbId: 550,
      titulo: 'Clube da Luta',
      posterUrl: filme.posterUrl,
      sinopse: filme.sinopse,
      dataEstreia: filme.dataEstreia,
      dataHora: '2030-01-01T20:00:00',
      preco: 25.5,
      capacidade: 40,
      organizadorId: 10,
    });
    const user = userEvent.setup();

    renderPage();

    await screen.findByRole('combobox');
    await user.selectOptions(screen.getByRole('combobox'), '1');
    const [dataHoraInput, precoInput] = screen.getAllByLabelText(/data e hora|preço/i);
    await user.type(dataHoraInput, '2030-01-01T20:00');
    await user.type(precoInput, '25.50');
    await user.click(screen.getByRole('button', { name: /criar sessão/i }));

    expect(await screen.findByText(/sessão criada/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /voltar à busca/i })).toHaveAttribute('href', '/organizador');
  });

  it('shows an error message without getting stuck loading when the submit fails', async () => {
    vi.spyOn(sessoesApi, 'listarSalas').mockResolvedValue([{ id: 1, nome: 'Sala 1', capacidade: 40 }]);
    vi.spyOn(sessoesApi, 'criarSessao').mockRejectedValue(new ApiRequestError('Sessão conflitante', 409));
    const user = userEvent.setup();

    renderPage();

    await screen.findByRole('combobox');
    await user.selectOptions(screen.getByRole('combobox'), '1');
    const [dataHoraInput, precoInput] = screen.getAllByLabelText(/data e hora|preço/i);
    await user.type(dataHoraInput, '2030-01-01T20:00');
    await user.type(precoInput, '25.50');
    await user.click(screen.getByRole('button', { name: /criar sessão/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Sessão conflitante');
    expect(screen.getByRole('button', { name: /criar sessão/i })).toBeEnabled();
  });
});
