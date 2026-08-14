import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
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
  tmdbId: 603,
  titulo: 'Matrix',
  esgotada: true,
};

function pagina(
  conteudo: SessaoPublicada[],
  extras: Partial<sessoesApi.Pagina<SessaoPublicada>> = {},
): sessoesApi.Pagina<SessaoPublicada> {
  return {
    conteudo,
    pagina: 0,
    tamanho: 12,
    total: conteudo.length,
    totalPaginas: conteudo.length === 0 ? 0 : 1,
    ...extras,
  };
}

function renderPagina() {
  return render(
    <MemoryRouter>
      <ListagemSessoesPage />
    </MemoryRouter>,
  );
}

function grade() {
  return within(screen.getByTestId('grade-filmes'));
}

describe('ListagemSessoesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Sem este stub a página chamaria a rede de verdade pra montar o filtro de sala. Ela trata a
    // falha e segue, então o teste passaria mesmo assim — mas com uma requisição solta a cada caso.
    vi.spyOn(sessoesApi, 'listarSalas').mockResolvedValue([
      { id: 1, nome: 'Sala 1 — Centro', capacidade: 120 },
      { id: 2, nome: 'Sala 2 — Drive-in', capacidade: 80 },
    ]);
  });

  it('filters by sala on the server and drops the page when the filter changes', async () => {
    const listarSpy = vi
      .spyOn(sessoesApi, 'listarSessoesPublicadas')
      .mockResolvedValue(pagina([sessaoComVaga], { total: 30, totalPaginas: 3 }));
    const user = userEvent.setup();

    renderPagina();
    await screen.findByTestId('grade-filmes');

    await user.click(screen.getByRole('button', { name: /página 2/i }));
    expect(listarSpy).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 1 }));

    await user.click(screen.getByRole('button', { name: /filtrar por sala/i }));
    await user.click(await screen.findByRole('option', { name: /drive-in/i }));

    // Página volta a zero junto com o filtro: manter a 2 costuma cair num vazio que parece
    // "essa sala não tem sessão" quando o resultado filtrado tem uma página só.
    expect(listarSpy).toHaveBeenLastCalledWith(expect.objectContaining({ salaId: 2, pagina: 0 }));
  });

  it('offers a way back to every sala after filtering', async () => {
    const listarSpy = vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([sessaoComVaga]));
    const user = userEvent.setup();

    renderPagina();
    await screen.findByTestId('grade-filmes');

    await user.click(screen.getByRole('button', { name: /filtrar por sala/i }));
    await user.click(await screen.findByRole('option', { name: /drive-in/i }));
    await user.click(screen.getByRole('button', { name: /filtrar por sala/i }));
    await user.click(await screen.findByRole('option', { name: /todas as salas/i }));

    expect(listarSpy).toHaveBeenLastCalledWith(expect.not.objectContaining({ salaId: expect.anything() }));
  });

  it('shows a loading state while sessions are being fetched', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockReturnValue(new Promise(() => {}));

    renderPagina();

    expect(await screen.findByText(/carregando sessões/i)).toBeInTheDocument();
  });

  it('shows an empty-list message when there are no sessions', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([]));

    renderPagina();

    expect(await screen.findByText(/nenhuma sessão disponível/i)).toBeInTheDocument();
  });

  it('shows an error message when sessions fail to load', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockRejectedValue(new Error('falha de rede'));

    renderPagina();

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar as sessões/i);
  });

  it('lists movies with vaga and esgotada, keeping the esgotada one visible', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([sessaoComVaga, sessaoEsgotada]));

    renderPagina();

    await screen.findByTestId('grade-filmes');
    expect(grade().getByText('Clube da Luta')).toBeInTheDocument();
    expect(grade().getByText('Matrix')).toBeInTheDocument();
    expect(grade().getByText('Esgotada')).toBeInTheDocument();
  });

  it('does not show the esgotada badge for a movie with available seats', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([sessaoComVaga]));

    renderPagina();

    await screen.findByTestId('grade-filmes');
    expect(screen.queryByText('Esgotada')).not.toBeInTheDocument();
  });

  // Paginação de verdade é decidida no servidor: sem os parâmetros na requisição, a barra
  // navegaria entre páginas que ninguém pediu e a tela mostraria sempre o mesmo conteúdo.
  it('asks the server for the page, not the whole list', async () => {
    const listarSpy = vi
      .spyOn(sessoesApi, 'listarSessoesPublicadas')
      .mockResolvedValue(pagina([sessaoComVaga], { totalPaginas: 3, total: 30 }));
    const user = userEvent.setup();

    renderPagina();
    await screen.findByTestId('grade-filmes');

    expect(listarSpy).toHaveBeenCalledWith(expect.objectContaining({ pagina: 0, tamanho: 12 }));

    await user.click(screen.getByRole('button', { name: /página 2/i }));

    expect(listarSpy).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 1 }));
  });

  it('hides the pagination bar when everything fits in one page', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([sessaoComVaga]));

    renderPagina();

    await screen.findByTestId('grade-filmes');
    expect(screen.queryByRole('navigation', { name: /paginação/i })).not.toBeInTheDocument();
  });

  it('retries loading the sessions when the retry button is clicked', async () => {
    const listarSpy = vi
      .spyOn(sessoesApi, 'listarSessoesPublicadas')
      .mockRejectedValueOnce(new Error('falha de rede'))
      .mockResolvedValueOnce(pagina([sessaoComVaga]));
    const user = userEvent.setup();

    renderPagina();

    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));

    await screen.findByTestId('grade-filmes');
    expect(grade().getByText('Clube da Luta')).toBeInTheDocument();
    expect(listarSpy).toHaveBeenCalledTimes(2);
  });
});
