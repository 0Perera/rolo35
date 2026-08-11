import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EditarSessaoPage } from './EditarSessaoPage';
import * as sessoesApi from '../api/sessoes';
import { ApiRequestError } from '../api/client';
import type { SessaoGestao } from '../api/sessoes';

const sessao: SessaoGestao = {
  id: 5,
  salaId: 1,
  salaNome: 'Sala 1',
  titulo: 'Clube da Luta',
  sinopse: 'Sinopse original',
  dataHora: '2030-01-01T20:00:00',
  preco: 25,
  capacidade: 40,
  editavel: true,
};

function renderPage(id = '5') {
  return render(
    <MemoryRouter initialEntries={[`/organizador/sessoes/${id}/editar`]}>
      <Routes>
        <Route path="/organizador/sessoes/:id/editar" element={<EditarSessaoPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EditarSessaoPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state while the session is being fetched', () => {
    vi.spyOn(sessoesApi, 'buscarSessao').mockReturnValue(new Promise(() => {}));
    vi.spyOn(sessoesApi, 'listarSalas').mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText(/carregando sessão/i)).toBeInTheDocument();
  });

  it('shows an error message with a retry button when the session fails to load', async () => {
    vi.spyOn(sessoesApi, 'buscarSessao').mockRejectedValue(new Error('falha de rede'));
    vi.spyOn(sessoesApi, 'listarSalas').mockResolvedValue([]);

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar esta sessão/i);
    expect(screen.getByRole('link', { name: /minhas sessões/i })).toHaveAttribute('href', '/organizador/sessoes');
  });

  it('pre-fills the form with the loaded session data', async () => {
    vi.spyOn(sessoesApi, 'buscarSessao').mockResolvedValue(sessao);
    vi.spyOn(sessoesApi, 'listarSalas').mockResolvedValue([{ id: 1, nome: 'Sala 1', capacidade: 40 }]);

    renderPage();

    expect(await screen.findByDisplayValue('Clube da Luta')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sinopse original')).toBeInTheDocument();
    expect(screen.getByDisplayValue('25')).toBeInTheDocument();
  });

  it('submits the edited fields to editarSessao', async () => {
    vi.spyOn(sessoesApi, 'buscarSessao').mockResolvedValue(sessao);
    vi.spyOn(sessoesApi, 'listarSalas').mockResolvedValue([{ id: 1, nome: 'Sala 1', capacidade: 40 }]);
    const editarSpy = vi.spyOn(sessoesApi, 'editarSessao').mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();

    renderPage();

    const tituloInput = await screen.findByDisplayValue('Clube da Luta');
    await user.clear(tituloInput);
    await user.type(tituloInput, 'Clube da Luta (editado)');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    await waitFor(() => {
      expect(editarSpy).toHaveBeenCalledWith(5, {
        salaId: 1,
        titulo: 'Clube da Luta (editado)',
        sinopse: 'Sinopse original',
        dataHora: '2030-01-01T20:00:00',
        preco: 25,
      });
    });
  });

  it('shows a success confirmation with a link back after a successful submit', async () => {
    vi.spyOn(sessoesApi, 'buscarSessao').mockResolvedValue(sessao);
    vi.spyOn(sessoesApi, 'listarSalas').mockResolvedValue([{ id: 1, nome: 'Sala 1', capacidade: 40 }]);
    vi.spyOn(sessoesApi, 'editarSessao').mockResolvedValue({
      id: 5,
      salaId: 1,
      salaNome: 'Sala 1',
      tmdbId: 550,
      titulo: 'Clube da Luta (editado)',
      posterUrl: null,
      sinopse: 'Sinopse original',
      dataEstreia: null,
      dataHora: '2030-01-01T20:00:00',
      preco: 25,
      capacidade: 40,
      organizadorId: 10,
    });
    const user = userEvent.setup();

    renderPage();

    await screen.findByDisplayValue('Clube da Luta');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(await screen.findByText(/sessão atualizada/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /minhas sessões/i })).toHaveAttribute('href', '/organizador/sessoes');
  });

  it('shows the trava pós-venda message from the backend without getting stuck loading', async () => {
    vi.spyOn(sessoesApi, 'buscarSessao').mockResolvedValue(sessao);
    vi.spyOn(sessoesApi, 'listarSalas').mockResolvedValue([{ id: 1, nome: 'Sala 1', capacidade: 40 }]);
    vi.spyOn(sessoesApi, 'editarSessao').mockRejectedValue(
      new ApiRequestError('Sessão já tem ingresso confirmado — nenhum campo pode ser editado', 409),
    );
    const user = userEvent.setup();

    renderPage();

    await screen.findByDisplayValue('Clube da Luta');
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/ingresso confirmado/i);
    expect(screen.getByRole('button', { name: /salvar alterações/i })).toBeEnabled();
  });
});
