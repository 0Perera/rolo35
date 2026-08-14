import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FilmeDetalhePage } from './FilmeDetalhePage';
import * as sessoesApi from '../api/sessoes';
import type { Pagina, SessaoPublicada } from '../api/sessoes';

function sessao(campos: Partial<SessaoPublicada> = {}): SessaoPublicada {
  return {
    id: 1,
    salaNome: 'Sala 1',
    tmdbId: 550,
    titulo: 'Clube da Luta',
    posterUrl: 'https://image.tmdb.org/poster.jpg',
    sinopse: 'Um funcionário insone e um vendedor de sabonetes.',
    dataEstreia: '1999-10-15',
    dataHora: '2030-01-10T20:00:00',
    preco: 25,
    capacidade: 100,
    esgotada: false,
    ...campos,
  };
}

function pagina(conteudo: SessaoPublicada[]): Pagina<SessaoPublicada> {
  return { conteudo, pagina: 0, tamanho: 50, total: conteudo.length, totalPaginas: 1 };
}

function renderPage(tmdbId = '550') {
  return render(
    <MemoryRouter initialEntries={[`/filmes/${tmdbId}`]}>
      <Routes>
        <Route path="/filmes/:tmdbId" element={<FilmeDetalhePage />} />
        <Route path="/sessoes/:id/assentos" element={<p>mapa de assentos</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('FilmeDetalhePage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state while the sessions are being fetched', () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('shows an alert when the listing fails', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockRejectedValue(new Error('falha de rede'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar esse filme/i);
  });

  // Vazio não é falha: o filme pode simplesmente ter saído de cartaz. Anunciar como alerta
  // trataria o fim natural de uma temporada como erro do sistema.
  it('reports an empty result as "out of cartaz", not as an error', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([]));

    renderPage();

    expect(await screen.findByText(/nenhuma sessão em cartaz/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // O filtro é do servidor, não da memória. Desde que a listagem virou paginada, buscar tudo e
  // filtrar aqui faria todo filme fora da primeira página virar "nenhuma sessão em cartaz".
  it('asks the API for this movie instead of filtering a page in memory', async () => {
    const listar = vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([sessao()]));

    renderPage('550');

    await screen.findByRole('heading', { name: 'Clube da Luta' });
    expect(listar).toHaveBeenCalledWith(expect.objectContaining({ tmdbId: 550 }));
  });

  it('renders poster, synopsis and the movie summary line', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(
      pagina([sessao({ id: 1 }), sessao({ id: 2, dataHora: '2030-01-10T22:30:00' })]),
    );

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Clube da Luta' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Clube da Luta' })).toHaveAttribute(
      'src',
      'https://image.tmdb.org/poster.jpg',
    );
    expect(screen.getByText(/funcionário insone/i)).toBeInTheDocument();
    // Escopado à linha do resumo: "SALA 1" também aparece em cada botão de horário logo abaixo.
    const resumo = screen.getByText('1999').closest('div');
    expect(resumo).toHaveTextContent('SALA 1');
    expect(resumo).toHaveTextContent('2 SESSÕES');
  });

  // "A partir de" só quando os preços divergem: com valor único ele vira ruído em cima do
  // próprio preço.
  it('says "a partir de" only when the sessions have different prices', async () => {
    const listar = vi
      .spyOn(sessoesApi, 'listarSessoesPublicadas')
      .mockResolvedValue(pagina([sessao({ id: 1, preco: 25 }), sessao({ id: 2, preco: 18 })]));

    const { unmount } = renderPage();
    expect(await screen.findByText('A PARTIR DE R$ 18,00')).toBeInTheDocument();
    unmount();

    listar.mockResolvedValue(pagina([sessao({ id: 1, preco: 25 }), sessao({ id: 2, preco: 25 })]));

    renderPage();
    expect(await screen.findByText('R$ 25,00')).toBeInTheDocument();
  });

  // Os horários vêm da API em qualquer ordem; a grade é lida como agenda, então o dia manda e
  // dentro do dia manda o relógio.
  it('groups the sessions by day, in chronological order', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(
      pagina([
        sessao({ id: 3, dataHora: '2030-01-11T18:00:00' }),
        sessao({ id: 1, dataHora: '2030-01-10T22:30:00' }),
        sessao({ id: 2, dataHora: '2030-01-10T20:00:00' }),
      ]),
    );

    renderPage();

    const horarios = await screen.findAllByRole('button');
    expect(horarios.map((botao) => botao.textContent)).toEqual([
      expect.stringContaining('20:00'),
      expect.stringContaining('22:30'),
      expect.stringContaining('18:00'),
    ]);
  });

  it('opens the seat map of the chosen session', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([sessao({ id: 42 })]));

    renderPage();
    await userEvent.setup().click(await screen.findByRole('button', { name: /20:00/ }));

    expect(screen.getByText('mapa de assentos')).toBeInTheDocument();
  });

  // Sessão esgotada continua na grade: ela informa que o horário existe e já foi tomado. O que
  // não pode é levar ao mapa de assentos e terminar num 409 lá na frente.
  it('shows a sold-out session as a disabled button', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(
      pagina([sessao({ id: 7, esgotada: true })]),
    );

    renderPage();

    const horario = await screen.findByRole('button', { name: /20:00/ });
    expect(horario).toBeDisabled();
    expect(horario).toHaveTextContent(/esgotada/i);
  });
});
