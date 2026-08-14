import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GerenciarSessoesPage } from './GerenciarSessoesPage';
import * as sessoesApi from '../api/sessoes';

function renderPage() {
  return render(
    <MemoryRouter>
      <GerenciarSessoesPage />
    </MemoryRouter>,
  );
}

describe('GerenciarSessoesPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // O formulário embutido no painel carrega as salas; sem o mock a chamada vaza pro fetch real.
    vi.spyOn(sessoesApi, 'listarSalas').mockResolvedValue([{ id: 1, nome: 'Sala 1', capacidade: 40 }]);
  });

  it('shows a loading state while sessions are being fetched', () => {
    vi.spyOn(sessoesApi, 'listarSessoesParaGestao').mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText(/carregando sessões/i)).toBeInTheDocument();
  });

  it('shows an empty-list message when the organizador has no sessions', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesParaGestao').mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText(/nenhuma sessão cadastrada ainda/i)).toBeInTheDocument();
  });

  it('shows an error message when sessions fail to load', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesParaGestao').mockRejectedValue(new Error('falha de rede'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar as sessões/i);
  });

  it('opens the inline edit form for editable sessions and keeps locked ones out of reach', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesParaGestao').mockResolvedValue([
      {
        id: 1,
        salaId: 1,
        salaNome: 'Sala 1',
        titulo: 'Editável',
        sinopse: null,
        dataHora: '2030-01-01T20:00:00',
        preco: 25,
        capacidade: 40,
        editavel: true,
      },
      {
        id: 2,
        salaId: 1,
        salaNome: 'Sala 1',
        titulo: 'Travada',
        sinopse: null,
        dataHora: '2030-01-02T20:00:00',
        preco: 25,
        capacidade: 40,
        editavel: false,
      },
    ]);

    const user = userEvent.setup();
    renderPage();

    const botoesEditar = await screen.findAllByRole('button', { name: /editar/i });
    expect(botoesEditar).toHaveLength(1);
    expect(screen.getByText('Travada', { selector: 'span' })).toBeInTheDocument();

    await user.click(botoesEditar[0]);

    expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeInTheDocument();
    expect(screen.getByText('Editável', { selector: 'p' })).toBeInTheDocument();
  });

  it('leaves the edit form after cancelling, back to the creation form', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesParaGestao').mockResolvedValue([
      {
        id: 1,
        salaId: 1,
        salaNome: 'Sala 1',
        titulo: 'Editável',
        sinopse: null,
        dataHora: '2030-01-01T20:00:00',
        preco: 25,
        capacidade: 40,
        editavel: true,
      },
    ]);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /✎ editar/i }));
    await user.click(screen.getByRole('button', { name: /cancelar edição/i }));

    expect(screen.getByRole('button', { name: /publicar sessão/i })).toBeInTheDocument();
  });

  it('retries loading sessions when the retry button is clicked', async () => {
    const spy = vi
      .spyOn(sessoesApi, 'listarSessoesParaGestao')
      .mockRejectedValueOnce(new Error('falha de rede'))
      .mockResolvedValueOnce([]);
    const user = userEvent.setup();

    renderPage();

    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));

    expect(await screen.findByText(/nenhuma sessão cadastrada ainda/i)).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
