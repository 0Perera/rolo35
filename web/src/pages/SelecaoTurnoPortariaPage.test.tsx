import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SelecaoTurnoPortariaPage } from './SelecaoTurnoPortariaPage';
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

function renderPagina() {
  return render(
    <MemoryRouter>
      <SelecaoTurnoPortariaPage />
    </MemoryRouter>,
  );
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
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue([]);
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

  it('lets the portaria user select an active session', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue([sessaoA, sessaoB]);
    vi.spyOn(portariaApi, 'buscarSessaoAtiva').mockResolvedValue(null);
    const selecionarSpy = vi.spyOn(portariaApi, 'selecionarSessaoTurno').mockResolvedValue({
      sessaoId: 1,
      titulo: 'Clube da Luta',
      salaNome: 'Sala 1',
      dataHora: '2030-01-01T20:00:00',
    });
    const user = userEvent.setup();

    renderPagina();

    await user.click(await screen.findByRole('button', { name: /selecionar sessão do turno/i }));
    await user.click(await screen.findByRole('option', { name: /clube da luta/i }));

    expect(selecionarSpy).toHaveBeenCalledWith(1);
    expect(await screen.findByText('SESSÃO ATIVA')).toBeInTheDocument();
  });

  it('lets the portaria user swap the active session without an extra step', async () => {
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue([sessaoA, sessaoB]);
    vi.spyOn(portariaApi, 'buscarSessaoAtiva').mockResolvedValue({
      sessaoId: 1,
      titulo: 'Clube da Luta',
      salaNome: 'Sala 1',
      dataHora: '2030-01-01T20:00:00',
    });
    const selecionarSpy = vi.spyOn(portariaApi, 'selecionarSessaoTurno').mockResolvedValue({
      sessaoId: 2,
      titulo: 'Matrix',
      salaNome: 'Sala 1',
      dataHora: '2030-01-01T20:00:00',
    });
    const user = userEvent.setup();

    renderPagina();

    expect(await screen.findByText('Clube da Luta')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /trocar sessão do turno/i }));
    await user.click(await screen.findByRole('option', { name: /matrix/i }));

    expect(selecionarSpy).toHaveBeenCalledWith(2);
    expect(await screen.findByText('Matrix')).toBeInTheDocument();
  });
});
