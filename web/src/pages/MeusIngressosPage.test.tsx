import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MeusIngressosPage } from './MeusIngressosPage';
import * as ingressosApi from '../api/ingressos';
import type { IngressoResumo } from '../api/ingressos';

const ingresso: IngressoResumo = {
  id: 'abc-123',
  status: 'VALIDO',
  assentoFileira: 'A',
  assentoNumero: 1,
  sessaoTitulo: 'Clube da Luta',
  sessaoPosterUrl: null,
  salaNome: 'Sala 1',
  dataHora: '2030-01-01T20:00:00',
  codigo: 'abc-123.assinatura',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/meus-ingressos']}>
      <MeusIngressosPage />
    </MemoryRouter>,
  );
}

describe('MeusIngressosPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state while ingressos are being fetched', () => {
    vi.spyOn(ingressosApi, 'listarMeusIngressos').mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('shows an empty state when the client has no ingressos', async () => {
    vi.spyOn(ingressosApi, 'listarMeusIngressos').mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText(/ainda não tem nenhum ingresso/i)).toBeInTheDocument();
  });

  it('shows a generic error message on failure', async () => {
    vi.spyOn(ingressosApi, 'listarMeusIngressos').mockRejectedValue(new Error('falha de rede'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i);
  });

  it('renders each ingresso with session title, sala and assento', async () => {
    vi.spyOn(ingressosApi, 'listarMeusIngressos').mockResolvedValue([ingresso]);

    renderPage();

    expect(await screen.findByText('Clube da Luta')).toBeInTheDocument();
    expect(screen.getByText(/SALA 1/)).toBeInTheDocument();
    expect(screen.getByText(/ASSENTO A1/)).toBeInTheDocument();
    expect(screen.getByText('VALIDO')).toBeInTheDocument();
  });
});
