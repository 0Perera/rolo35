import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SelecaoTurnoPortariaPage } from './SelecaoTurnoPortariaPage';
import { ApiRequestError } from '../api/client';
import * as portariaApi from '../api/portaria';
import * as sessoesApi from '../api/sessoes';
import type { SessaoPublicada } from '../api/sessoes';

const sessaoA: SessaoPublicada = {
  id: 1,
  salaNome: 'Sala 1',
  tmdbId: 550,
  titulo: 'Clube da Luta',
  posterUrl: null,
  sinopse: null,
  dataEstreia: '1999-10-15',
  dataHora: '2030-01-01T20:00:00',
  preco: 25.5,
  capacidade: 40,
  esgotada: false,
};

const sessaoB: SessaoPublicada = { ...sessaoA, id: 2, titulo: 'Matrix' };
const sessaoC: SessaoPublicada = { ...sessaoA, id: 3, titulo: 'Duna' };

const turnoClubeDaLuta = {
  sessaoId: 1,
  titulo: 'Clube da Luta',
  salaNome: 'Sala 1',
  dataHora: '2030-01-01T20:00:00',
};

function pagina(
  conteudo: SessaoPublicada[],
  extras: Partial<sessoesApi.Pagina<SessaoPublicada>> = {},
): sessoesApi.Pagina<SessaoPublicada> {
  return {
    conteudo,
    pagina: 0,
    tamanho: 8,
    total: conteudo.length,
    totalPaginas: conteudo.length === 0 ? 0 : 1,
    ...extras,
  };
}

function renderPagina() {
  return render(
    <MemoryRouter>
      <SelecaoTurnoPortariaPage />
    </MemoryRouter>,
  );
}

/** A lista de sessões, sem o card de sessão ativa que fica acima dela. */
async function listaDeSessoes() {
  return within(await screen.findByRole('list'));
}

describe('SelecaoTurnoPortariaPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state while sessions are being fetched', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockReturnValue(new Promise(() => {}));
    vi.spyOn(portariaApi, 'buscarSessaoAtiva').mockReturnValue(new Promise(() => {}));

    renderPagina();

    expect(await screen.findByText(/carregando sessões/i)).toBeInTheDocument();
  });

  it('shows an empty-list message when there are no sessions', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([]));
    vi.spyOn(portariaApi, 'buscarSessaoAtiva').mockResolvedValue(null);

    renderPagina();

    expect(await screen.findByText(/nenhuma sessão disponível/i)).toBeInTheDocument();
  });

  it('shows an error message when sessions fail to load', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockRejectedValue(new Error('falha de rede'));
    vi.spyOn(portariaApi, 'buscarSessaoAtiva').mockResolvedValue(null);

    renderPagina();

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar as sessões/i);
  });

  it('lists the sessions with sala and horário so the operator can tell them apart', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([sessaoA, sessaoB]));
    vi.spyOn(portariaApi, 'buscarSessaoAtiva').mockResolvedValue(null);

    renderPagina();

    expect(await screen.findByText(/2 sessões encontradas/i)).toBeInTheDocument();
    const lista = await listaDeSessoes();
    expect(lista.getByText('Clube da Luta')).toBeInTheDocument();
    expect(lista.getByText('Matrix')).toBeInTheDocument();
    expect(lista.getAllByText(/Sala 1/)).toHaveLength(2);
  });

  it('lets the portaria user select an active session straight from the list', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([sessaoA, sessaoB]));
    vi.spyOn(portariaApi, 'buscarSessaoAtiva').mockResolvedValue(null);
    const selecionarSpy = vi.spyOn(portariaApi, 'selecionarSessaoTurno').mockResolvedValue(turnoClubeDaLuta);
    const user = userEvent.setup();

    renderPagina();

    await user.click((await listaDeSessoes()).getByRole('button', { name: /clube da luta/i }));

    expect(selecionarSpy).toHaveBeenCalledWith(1);
    expect(await screen.findByText(/sessão ativa do turno/i)).toBeInTheDocument();
  });

  it('lets the portaria user swap the active session without an extra step', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([sessaoA, sessaoB]));
    vi.spyOn(portariaApi, 'buscarSessaoAtiva').mockResolvedValue(turnoClubeDaLuta);
    const selecionarSpy = vi.spyOn(portariaApi, 'selecionarSessaoTurno').mockResolvedValue({
      sessaoId: 2,
      titulo: 'Matrix',
      salaNome: 'Sala 1',
      dataHora: '2030-01-01T20:00:00',
    });
    const user = userEvent.setup();

    renderPagina();

    await user.click((await listaDeSessoes()).getByRole('button', { name: /matrix/i }));

    expect(selecionarSpy).toHaveBeenCalledWith(2);
    expect(await screen.findByText('Matrix')).toBeInTheDocument();
  });

  // Sem tratamento, a falha some e o painel segue mostrando a sessão anterior: a portaria acredita
  // que trocou de turno e passa a ver EVENTO_ERRADO em ingressos legítimos.
  it('reports a failed session swap instead of silently keeping the old one', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([sessaoA, sessaoB]));
    vi.spyOn(portariaApi, 'buscarSessaoAtiva').mockResolvedValue(turnoClubeDaLuta);
    vi.spyOn(portariaApi, 'selecionarSessaoTurno').mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();

    renderPagina();

    await user.click((await listaDeSessoes()).getByRole('button', { name: /matrix/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível trocar a sessão/i);
    // E o painel continua honesto sobre qual sessão está de fato ativa.
    expect(screen.getByText('Clube da Luta')).toBeInTheDocument();
  });

  // A janela de -30min/+2h mora no servidor (PortariaService). Sem repetir o motivo na tela, a
  // recusa vira "não foi possível" e o operador tenta a mesma sessão pra sempre.
  it('explains the shift window when the server refuses a session outside it', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([sessaoA, sessaoB]));
    vi.spyOn(portariaApi, 'buscarSessaoAtiva').mockResolvedValue(turnoClubeDaLuta);
    vi.spyOn(portariaApi, 'selecionarSessaoTurno').mockRejectedValue(
      new ApiRequestError('Sessão fora da janela', 409, 'SESSAO_FORA_DA_JANELA_DO_TURNO'),
    );
    const user = userEvent.setup();

    renderPagina();

    await user.click((await listaDeSessoes()).getByRole('button', { name: /matrix/i }));

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(/30 min/i);
    expect(alerta).toHaveTextContent(/2 h/i);
  });

  // O aviso montava e desmontava a cada clique, empurrando a tela inteira pra cima e de volta —
  // parecia bug de renderização. O slot fica reservado mesmo vazio.
  it('keeps the notice slot reserved so the page does not jump on click', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([sessaoA, sessaoB]));
    vi.spyOn(portariaApi, 'buscarSessaoAtiva').mockResolvedValue(turnoClubeDaLuta);
    vi.spyOn(portariaApi, 'selecionarSessaoTurno').mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();

    renderPagina();
    const lista = await listaDeSessoes();
    expect(screen.getByTestId('aviso-troca')).toBeInTheDocument();

    await user.click(lista.getByRole('button', { name: /matrix/i }));
    await screen.findByRole('alert');

    expect(screen.getByTestId('aviso-troca')).toBeInTheDocument();
  });

  // Escurecer a lista inteira num piscar transformava a espera em glitch. Quem está abrindo é uma
  // linha só, e ela precisa dizer isso — inclusive pra quem não enxerga a opacidade mudar.
  it('shows which session is opening and marks only that row as busy', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([sessaoA, sessaoB, sessaoC]));
    vi.spyOn(portariaApi, 'buscarSessaoAtiva').mockResolvedValue(turnoClubeDaLuta);
    vi.spyOn(portariaApi, 'selecionarSessaoTurno').mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    renderPagina();
    const lista = await listaDeSessoes();

    await user.click(lista.getByRole('button', { name: /matrix/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/abrindo matrix/i);
    expect(lista.getByRole('button', { name: /matrix/i })).toHaveAttribute('aria-busy', 'true');
    expect(lista.getByRole('button', { name: /duna/i })).toHaveAttribute('aria-busy', 'false');
  });

  // "2 sessões encontradas" com uma linha só na tela parece resultado sumido. A que falta é a
  // ativa, que já tem card próprio acima e não repete na lista.
  it('says why the count is bigger than the list when the active session was filtered out', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([sessaoA, sessaoB]));
    vi.spyOn(portariaApi, 'buscarSessaoAtiva').mockResolvedValue(turnoClubeDaLuta);

    renderPagina();

    expect(await screen.findByText(/2 sessões encontradas/i)).toHaveTextContent(/ativa acima/i);
  });

  // A lista pública filtra `data_hora >= now()`, então a sessão sai dela no instante em que começa
  // — justamente quando a portaria trabalha. Por isso o card do turno vive fora da lista: se
  // dependesse dela, sumiria da tela no pior momento possível.
  it('keeps the active session on screen after it started and left the public list', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([]));
    vi.spyOn(portariaApi, 'buscarSessaoAtiva').mockResolvedValue({
      sessaoId: 7,
      titulo: 'Clube da Luta',
      salaNome: 'Sala 1',
      dataHora: '2020-01-01T20:00:00',
    });

    renderPagina();

    expect(await screen.findByText(/sessão ativa do turno/i)).toBeInTheDocument();
    expect(screen.getByText('Clube da Luta')).toBeInTheDocument();
    // A lista vazia não pode dizer "nenhuma sessão disponível" com um turno rodando.
    expect(screen.queryByText(/nenhuma sessão disponível/i)).not.toBeInTheDocument();
    expect(screen.getByText(/o turno acima segue ativo/i)).toBeInTheDocument();
  });

  // A busca também não pode apagar o turno ativo da tela: ele não vem da listagem.
  it('keeps the active session visible when a search returns nothing', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue(pagina([]));
    vi.spyOn(portariaApi, 'buscarSessaoAtiva').mockResolvedValue(turnoClubeDaLuta);
    const user = userEvent.setup();

    renderPagina();
    await screen.findByText(/sessão ativa do turno/i);

    await user.type(screen.getByRole('searchbox', { name: /buscar sessão/i }), 'xyz');

    expect(await screen.findByText(/nenhuma sessão encontrada para/i)).toBeInTheDocument();
    expect(screen.getByText(/sessão ativa do turno/i)).toBeInTheDocument();
  });

  it('asks the server for the search term and the page', async () => {
    const listarSpy = vi
      .spyOn(sessoesApi, 'listarSessoesPublicadas')
      .mockResolvedValue(pagina([sessaoA], { total: 20, totalPaginas: 3 }));
    vi.spyOn(portariaApi, 'buscarSessaoAtiva').mockResolvedValue(null);
    const user = userEvent.setup();

    renderPagina();
    await screen.findByText(/20 sessões encontradas/i);

    expect(listarSpy).toHaveBeenCalledWith(expect.objectContaining({ pagina: 0, tamanho: 8 }));

    await user.click(screen.getByRole('button', { name: /página 2/i }));
    expect(listarSpy).toHaveBeenLastCalledWith(expect.objectContaining({ pagina: 1 }));

    await user.type(screen.getByRole('searchbox', { name: /buscar sessão/i }), 'matrix');
    // Termo novo volta pra primeira página: manter a página 2 costuma cair num vazio que parece
    // "não encontrei nada" quando o resultado tem uma página só. O waitFor cobre o debounce da
    // busca — sem ele a asserção corre antes da requisição sair.
    await waitFor(() =>
      expect(listarSpy).toHaveBeenLastCalledWith(expect.objectContaining({ busca: 'matrix', pagina: 0 })),
    );
  });
});
