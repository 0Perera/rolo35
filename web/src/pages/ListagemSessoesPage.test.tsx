import { fireEvent, render, screen, within } from '@testing-library/react';
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

  // O aparelho é o cenário da página, não um resultado de busca: desmontá-lo derrubava a altura do
  // documento de uns 2000px pra uns 400px e devolvia o pulo de rolagem que o resto da tela já
  // evitava. Uma TV de tubo sem sinal mostra chuvisco — ela não some da sala.
  it('keeps the TV on the air showing SEM SINAL when the sala has no sessions', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas')
      .mockResolvedValueOnce(pagina([sessaoComVaga]))
      .mockResolvedValueOnce(pagina([]));
    const user = userEvent.setup();

    renderPagina();
    await screen.findByTestId('hero-vitrine');

    await user.click(screen.getByRole('button', { name: /filtrar por sala/i }));
    await user.click(await screen.findByRole('option', { name: /drive-in/i }));

    const tv = within(await screen.findByTestId('hero-vitrine'));
    expect(await tv.findByText(/sem sinal/i)).toBeInTheDocument();
    // Dizer qual sala ficou vazia, não só que deu vazio: sem o nome, o visitante não sabe qual
    // filtro desfazer quando busca e sala estão ligadas ao mesmo tempo.
    expect(tv.getByText(/drive-in/i)).toBeInTheDocument();
    expect(tv.getByRole('button', { name: /limpar filtros/i })).toBeInTheDocument();
  });

  // Sair do vazio recarrega com a lista ainda vazia: sem resultado e sem `estado === 'vazio'`, o
  // aparelho caía no vão entre os dois e a tela inteira piscava no clique de LIMPAR FILTROS. Uma
  // vez no ar, o tubo não desliga mais — só troca o que mostra.
  it('keeps the TV mounted while clearing the filters reloads the catalogue', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas')
      .mockResolvedValueOnce(pagina([sessaoComVaga]))
      .mockResolvedValueOnce(pagina([]))
      .mockReturnValueOnce(new Promise(() => {}));
    const user = userEvent.setup();

    renderPagina();
    await screen.findByTestId('hero-vitrine');

    await user.click(screen.getByRole('button', { name: /filtrar por sala/i }));
    await user.click(await screen.findByRole('option', { name: /drive-in/i }));
    await screen.findByText(/sem sinal/i);

    await user.click(screen.getByRole('button', { name: /limpar filtros/i }));

    expect(screen.getByTestId('hero-vitrine')).toBeInTheDocument();
  });

  // Mesmo vão, outra saída: a falha também desmontava o aparelho e derrubava a altura da página.
  it('reports a failed load inside the tube instead of switching the TV off', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockRejectedValue(new Error('falha de rede'));

    renderPagina();

    const tv = within(await screen.findByTestId('hero-vitrine'));
    expect(tv.getByRole('alert')).toHaveTextContent(/não foi possível carregar as sessões/i);
  });

  // Com o vazio dentro do tubo, a caixa tracejada abaixo repetia a mesma frase e o mesmo botão.
  it('does not repeat the empty state below the TV', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([]));

    renderPagina();
    await screen.findByText(/sem sinal/i);

    expect(screen.getAllByRole('button', { name: /tentar novamente/i })).toHaveLength(1);
    expect(screen.queryByTestId('grade-filmes')).not.toBeInTheDocument();
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

  // Hero e grade eram condicionados a `estado === 'pronto'`, então cada busca ou troca de filtro
  // desmontava os dois e deixava uma linha de texto no lugar. O documento encolhia de uns 2000px
  // pra uns 400px, o navegador cortava `scrollY` pro novo máximo e o visitante era jogado pro topo
  // — sem ninguém ter chamado `scrollTo`. Manter montado é o que segura a altura, e a rolagem
  // junto com ela.
  it('keeps the grid mounted while the filtered page is still loading', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas')
      .mockResolvedValueOnce(pagina([sessaoComVaga]))
      .mockReturnValueOnce(new Promise(() => {}));
    const user = userEvent.setup();

    renderPagina();
    await screen.findByTestId('grade-filmes');

    await user.click(screen.getByRole('button', { name: /filtrar por sala/i }));
    await user.click(await screen.findByRole('option', { name: /drive-in/i }));

    expect(screen.getByTestId('grade-filmes')).toBeInTheDocument();
    expect(grade().getByText('Clube da Luta')).toBeInTheDocument();
  });

  it('keeps the hero mounted while the filtered page is still loading', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas')
      .mockResolvedValueOnce(pagina([sessaoComVaga]))
      .mockReturnValueOnce(new Promise(() => {}));
    const user = userEvent.setup();

    renderPagina();
    await screen.findByTestId('hero-vitrine');

    await user.click(screen.getByRole('button', { name: /filtrar por sala/i }));
    await user.click(await screen.findByRole('option', { name: /drive-in/i }));

    expect(screen.getByTestId('hero-vitrine')).toBeInTheDocument();
  });

  // Segurar o conteúdo antigo na tela sem dizer nada faz a troca de filtro parecer que não
  // funcionou. `aria-busy` é o que conta a quem não vê a opacidade mudar.
  it('announces that the shown results are being refreshed', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas')
      .mockResolvedValueOnce(pagina([sessaoComVaga]))
      .mockReturnValueOnce(new Promise(() => {}));
    const user = userEvent.setup();

    renderPagina();
    await screen.findByTestId('grade-filmes');
    expect(screen.getByTestId('grade-filmes')).toHaveAttribute('aria-busy', 'false');

    await user.click(screen.getByRole('button', { name: /filtrar por sala/i }));
    await user.click(await screen.findByRole('option', { name: /drive-in/i }));

    expect(screen.getByTestId('grade-filmes')).toHaveAttribute('aria-busy', 'true');
  });

  // Escurecer o hero junto com a grade fazia a maior superfície escura da página piscar a cada
  // tecla digitada e a cada troca de sala. O aparelho é moldura: ele não é o resultado que mudou.
  it('dims only the grid while refreshing, never the TV', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas')
      .mockResolvedValueOnce(pagina([sessaoComVaga]))
      .mockReturnValueOnce(new Promise(() => {}));
    const user = userEvent.setup();

    renderPagina();
    await screen.findByTestId('grade-filmes');

    await user.click(screen.getByRole('button', { name: /filtrar por sala/i }));
    await user.click(await screen.findByRole('option', { name: /drive-in/i }));

    expect(screen.getByTestId('grade-filmes').className).toMatch(/opacity-/);
    expect(screen.getByTestId('hero-vitrine').className).not.toMatch(/opacity-/);
  });

  // Trocar o `src` seco deixava o tubo preto enquanto o pôster novo baixava — o "flash" no meio da
  // troca de canal. Ele entra em fade só depois de carregado.
  it('only reveals the hero poster once it has loaded', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([sessaoComVaga]));

    renderPagina();
    const poster = await screen.findByTestId('hero-poster');

    expect(poster.className).toMatch(/opacity-0/);
    fireEvent.load(poster);
    expect(poster.className).not.toMatch(/opacity-0/);
  });

  // A falha das salas era engolida por um `catch` vazio pra não derrubar a vitrine — certo em não
  // derrubar, errado em não contar. O seletor abria com "TODAS AS SALAS" e nada mais, e parecia
  // que o filtro exigia login. Não derrubar não é o mesmo que fingir que deu certo.
  it('says the sala filter is unavailable instead of offering an empty one', async () => {
    vi.spyOn(sessoesApi, 'listarSalas').mockRejectedValue(new Error('falha de rede'));
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([sessaoComVaga]));

    renderPagina();
    await screen.findByTestId('grade-filmes');

    expect(await screen.findByText(/filtro de sala indisponível/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /filtrar por sala/i })).not.toBeInTheDocument();
  });

  // A vitrine é o conteúdo principal: sala que não carrega não pode levar o catálogo junto.
  it('still lists the movies when the salas fail to load', async () => {
    vi.spyOn(sessoesApi, 'listarSalas').mockRejectedValue(new Error('falha de rede'));
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([sessaoComVaga]));

    renderPagina();

    await screen.findByTestId('grade-filmes');
    expect(grade().getByText('Clube da Luta')).toBeInTheDocument();
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
