import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FormSessao } from './FormSessao';
import * as filmesApi from '../api/filmes';
import * as sessoesApi from '../api/sessoes';
import { ApiRequestError } from '../api/client';
import type { Sala, SessaoGestao } from '../api/sessoes';

const SALAS: Sala[] = [
  { id: 1, nome: 'Sala 1', capacidade: 80 },
  { id: 2, nome: 'Sala 2', capacidade: 30 },
];

const FILME: filmesApi.Filme = {
  tmdbId: 550,
  titulo: 'Clube da Luta',
  posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
  sinopse: 'Sinopse do filme',
  dataEstreia: '1999-10-15',
};

const SESSAO: SessaoGestao = {
  id: 7,
  salaId: 1,
  salaNome: 'Sala 1',
  titulo: 'Clube da Luta',
  sinopse: 'Sinopse do filme',
  dataHora: '2030-01-02T20:30:00',
  preco: 25,
  capacidade: 80,
  editavel: true,
};

function renderForm(emEdicao: SessaoGestao | null = null) {
  const onSalvou = vi.fn();
  const onCancelarEdicao = vi.fn();
  render(
    <FormSessao salas={SALAS} emEdicao={emEdicao} onSalvou={onSalvou} onCancelarEdicao={onCancelarEdicao} />,
  );
  return { onSalvou, onCancelarEdicao };
}

async function escolherFilme(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /escolher filme/i }));
  await user.type(screen.getByLabelText(/buscar filme no catálogo/i), 'clube');
  await user.click(await screen.findByRole('option', { name: /clube da luta/i }));
}

async function escolherSala(user: ReturnType<typeof userEvent.setup>, nome: RegExp) {
  await user.click(screen.getByRole('button', { name: 'SALA' }));
  await user.click(screen.getByRole('option', { name: nome }));
}

const OCUPACAO: sessoesApi.OcupacaoSala[] = [
  {
    sessaoId: 9,
    dataHora: '2030-01-05T20:00:00',
    bloqueadoDe: '2030-01-05T16:00:00',
    bloqueadoAte: '2030-01-06T00:00:00',
  },
];

describe('FormSessao', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(filmesApi, 'buscarFilmes').mockResolvedValue([FILME]);
    vi.spyOn(sessoesApi, 'listarOcupacaoDaSala').mockResolvedValue([]);
  });

  // O conflito de sala era descoberto só pelo 409 depois do submit; agora a janela bloqueada
  // aparece assim que a sala é escolhida.
  it('lists the blocked windows of the chosen room, buffer included', async () => {
    const ocupacaoSpy = vi.spyOn(sessoesApi, 'listarOcupacaoDaSala').mockResolvedValue(OCUPACAO);
    const user = userEvent.setup();

    renderForm();
    await escolherSala(user, /sala 1/i);

    expect(ocupacaoSpy).toHaveBeenCalledWith(1);
    expect(await screen.findByText(/16:00.*00:00/)).toBeInTheDocument();
  });

  it('says so when the room has no blocked window at all', async () => {
    const user = userEvent.setup();

    renderForm();
    await escolherSala(user, /sala 2/i);

    expect(await screen.findByText(/nenhum horário ocupado/i)).toBeInTheDocument();
  });

  // A sessão em edição não é obstáculo pra si mesma — o back já a exclui na checagem de conflito.
  it('hides the window of the session currently being edited', async () => {
    vi.spyOn(sessoesApi, 'listarOcupacaoDaSala').mockResolvedValue([
      ...OCUPACAO,
      {
        sessaoId: SESSAO.id,
        dataHora: SESSAO.dataHora,
        bloqueadoDe: '2030-01-02T16:30:00',
        bloqueadoAte: '2030-01-03T00:30:00',
      },
    ]);

    renderForm(SESSAO);

    expect(await screen.findByText(/16:00.*00:00/)).toBeInTheDocument();
    expect(screen.queryByText(/16:30.*00:30/)).not.toBeInTheDocument();
  });

  // Aviso preventivo não é validação: quem decide se o horário serve continua sendo o POST, e um
  // alerta de rede aqui competiria com o erro de verdade.
  it('stays quiet when the occupancy call fails', async () => {
    vi.spyOn(sessoesApi, 'listarOcupacaoDaSala').mockRejectedValue(new Error('falha de rede'));
    const user = userEvent.setup();

    renderForm();
    await escolherSala(user, /sala 1/i);

    expect(screen.queryByText(/sala já ocupada/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('creates a session with the chosen movie, room, date, time and price', async () => {
    const criar = vi.spyOn(sessoesApi, 'criarSessao').mockResolvedValue({
      ...SESSAO,
      tmdbId: 550,
      posterUrl: FILME.posterUrl,
      dataEstreia: FILME.dataEstreia,
      organizadorId: 1,
    });
    const user = userEvent.setup();
    const { onSalvou } = renderForm();

    await escolherFilme(user);
    await escolherSala(user, /sala 2/i);
    await user.type(screen.getByLabelText('DATA'), '16082026');
    await user.type(screen.getByLabelText('HORA'), '2030');
    await user.type(screen.getByLabelText(/preço/i), '28');
    await user.click(screen.getByRole('button', { name: /publicar sessão/i }));

    expect(criar).toHaveBeenCalledWith({
      salaId: 2,
      tmdbId: 550,
      titulo: 'Clube da Luta',
      posterUrl: FILME.posterUrl,
      sinopse: FILME.sinopse,
      dataEstreia: FILME.dataEstreia,
      dataHora: '2026-08-16T20:30:00',
      preco: 28,
    });
    expect(onSalvou).toHaveBeenCalled();
  });

  it('refuses to submit without a movie', async () => {
    const criar = vi.spyOn(sessoesApi, 'criarSessao');
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: /publicar sessão/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/escolha um filme/i);
    expect(criar).not.toHaveBeenCalled();
  });

  it('rejects a date that does not exist', async () => {
    const criar = vi.spyOn(sessoesApi, 'criarSessao');
    const user = userEvent.setup();
    renderForm();

    await escolherFilme(user);
    await escolherSala(user, /sala 1/i);
    await user.type(screen.getByLabelText('DATA'), '31022026');
    await user.type(screen.getByLabelText('HORA'), '2030');
    await user.type(screen.getByLabelText(/preço/i), '28');
    await user.click(screen.getByRole('button', { name: /publicar sessão/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/data no formato/i);
    expect(criar).not.toHaveBeenCalled();
  });

  it('shows the message the API returns when creation is refused', async () => {
    vi.spyOn(sessoesApi, 'criarSessao').mockRejectedValue(
      new ApiRequestError('Já existe sessão nessa sala nesse horário.', 409),
    );
    const user = userEvent.setup();
    renderForm();

    await escolherFilme(user);
    await escolherSala(user, /sala 1/i);
    await user.type(screen.getByLabelText('DATA'), '16082026');
    await user.type(screen.getByLabelText('HORA'), '2030');
    await user.type(screen.getByLabelText(/preço/i), '28');
    await user.click(screen.getByRole('button', { name: /publicar sessão/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/já existe sessão nessa sala/i);
  });

  it('loads the session being edited and saves it without touching the movie', async () => {
    const editar = vi.spyOn(sessoesApi, 'editarSessao').mockResolvedValue({
      ...SESSAO,
      tmdbId: 550,
      posterUrl: FILME.posterUrl,
      dataEstreia: FILME.dataEstreia,
      organizadorId: 1,
    });
    const user = userEvent.setup();
    const { onSalvou } = renderForm(SESSAO);

    expect(screen.getByLabelText('DATA')).toHaveValue('02/01/2030');
    expect(screen.getByLabelText('HORA')).toHaveValue('20:30');
    expect(screen.getByLabelText(/preço/i)).toHaveValue(25);
    expect(screen.queryByRole('button', { name: /escolher filme/i })).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText(/preço/i));
    await user.type(screen.getByLabelText(/preço/i), '30');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(editar).toHaveBeenCalledWith(7, {
      salaId: 1,
      titulo: 'Clube da Luta',
      sinopse: 'Sinopse do filme',
      dataHora: '2030-01-02T20:30:00',
      preco: 30,
    });
    expect(onSalvou).toHaveBeenCalled();
  });

  it('reports back when the edition is cancelled', async () => {
    const user = userEvent.setup();
    const { onCancelarEdicao } = renderForm(SESSAO);

    await user.click(screen.getByRole('button', { name: /cancelar edição/i }));

    expect(onCancelarEdicao).toHaveBeenCalled();
  });
});
