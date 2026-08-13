import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { IngressoPublicoPage } from './IngressoPublicoPage';
import * as ingressosApi from '../api/ingressos';
import { ApiRequestError } from '../api/client';
import type { IngressoPublico } from '../api/ingressos';

const ingressoPublico: IngressoPublico = {
  sessaoTitulo: 'Clube da Luta',
  salaNome: 'Sala 1',
  dataHora: '2030-01-01T20:00:00',
  status: 'VALIDO',
};

function renderPage(codigo = 'abc-123.assinatura') {
  return render(
    <MemoryRouter initialEntries={[`/ingressos/${codigo}`]}>
      <Routes>
        <Route path="/ingressos/:codigo" element={<IngressoPublicoPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('IngressoPublicoPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state while the ingresso is being fetched', () => {
    vi.spyOn(ingressosApi, 'buscarIngressoPublico').mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('shows a not-found message for a 404', async () => {
    vi.spyOn(ingressosApi, 'buscarIngressoPublico').mockRejectedValue(new ApiRequestError('não encontrado', 404));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/ingresso não encontrado/i);
  });

  it('shows a generic error message for a non-404 failure', async () => {
    vi.spyOn(ingressosApi, 'buscarIngressoPublico').mockRejectedValue(new Error('falha de rede'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i);
  });

  it('renders session title, sala and status without any action control', async () => {
    vi.spyOn(ingressosApi, 'buscarIngressoPublico').mockResolvedValue(ingressoPublico);

    renderPage();

    expect(await screen.findByText('Clube da Luta')).toBeInTheDocument();
    expect(screen.getByText(/SALA 1/)).toBeInTheDocument();
    expect(screen.getByText('VALIDO')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the canhoto with the signed code and a QR of its own public link', async () => {
    vi.spyOn(ingressosApi, 'buscarIngressoPublico').mockResolvedValue(ingressoPublico);

    renderPage();

    expect(await screen.findByText(/CÓDIGO abc-123\.assinatura/)).toBeInTheDocument();
    expect(screen.getByTitle(`QR code do ingresso (${window.location.origin}/ingressos/abc-123.assinatura)`))
      .toBeInTheDocument();
    expect(screen.getByText(/escaneie na portaria/i)).toBeInTheDocument();
  });
});
