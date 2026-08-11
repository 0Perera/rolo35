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
  });

  it('shows a loading state while sessions are being fetched', () => {
    vi.spyOn(sessoesApi, 'listarMinhasSessoes').mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText(/carregando sessões/i)).toBeInTheDocument();
  });

  it('shows an empty-list message when the organizador has no sessions', async () => {
    vi.spyOn(sessoesApi, 'listarMinhasSessoes').mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText(/ainda não criou nenhuma sessão/i)).toBeInTheDocument();
  });

  it('shows an error message when sessions fail to load', async () => {
    vi.spyOn(sessoesApi, 'listarMinhasSessoes').mockRejectedValue(new Error('falha de rede'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar suas sessões/i);
  });

  it('shows an edit link for editable sessions and a locked badge for non-editable ones', async () => {
    vi.spyOn(sessoesApi, 'listarMinhasSessoes').mockResolvedValue([
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

    renderPage();

    const linkEditar = await screen.findByRole('link', { name: /editar/i });
    expect(linkEditar).toHaveAttribute('href', '/organizador/sessoes/1/editar');
    expect(screen.getByText('Travada', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /editar/i })).toHaveLength(1);
  });

  it('retries loading sessions when the retry button is clicked', async () => {
    const spy = vi
      .spyOn(sessoesApi, 'listarMinhasSessoes')
      .mockRejectedValueOnce(new Error('falha de rede'))
      .mockResolvedValueOnce([]);
    const user = userEvent.setup();

    renderPage();

    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: /tentar novamente/i }));

    expect(await screen.findByText(/ainda não criou nenhuma sessão/i)).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
