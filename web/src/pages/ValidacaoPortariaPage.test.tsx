import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ValidacaoPortariaPage } from './ValidacaoPortariaPage';
import * as portariaApi from '../api/portaria';
import { ApiRequestError } from '../api/client';

const startMock = vi.fn().mockResolvedValue(undefined);
const stopMock = vi.fn();
const destroyMock = vi.fn();

vi.mock('qr-scanner', () => ({
  default: vi.fn().mockImplementation(function QrScannerMock() {
    return { start: startMock, stop: stopMock, destroy: destroyMock };
  }),
}));

function renderPagina() {
  return render(
    <MemoryRouter>
      <ValidacaoPortariaPage />
    </MemoryRouter>,
  );
}

async function validarCodigo(codigo: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/código do ingresso/i), codigo);
  await user.click(screen.getByRole('button', { name: /^validar$/i }));
}

describe('ValidacaoPortariaPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    startMock.mockClear();
  });

  it('shows VALIDO with seat and session info for a valid ticket', async () => {
    vi.spyOn(portariaApi, 'validarIngresso').mockResolvedValue({
      resultado: 'VALIDO',
      assentoFileira: 'A',
      assentoNumero: 1,
      sessaoTitulo: 'Clube da Luta',
    });

    renderPagina();
    await validarCodigo('codigo-valido');

    expect(await screen.findByText(/válido/i)).toBeInTheDocument();
    expect(screen.getByText('Clube da Luta')).toBeInTheDocument();
    expect(screen.getByText(/assento a1/i)).toBeInTheDocument();
  });

  it('shows INVALIDO for a malformed or forged code', async () => {
    vi.spyOn(portariaApi, 'validarIngresso').mockResolvedValue({
      resultado: 'INVALIDO',
      assentoFileira: null,
      assentoNumero: null,
      sessaoTitulo: null,
    });

    renderPagina();
    await validarCodigo('codigo-forjado');

    expect(await screen.findByText(/inválido/i)).toBeInTheDocument();
  });

  it('shows JA_UTILIZADO for a ticket already validated', async () => {
    vi.spyOn(portariaApi, 'validarIngresso').mockResolvedValue({
      resultado: 'JA_UTILIZADO',
      assentoFileira: 'B',
      assentoNumero: 2,
      sessaoTitulo: 'Matrix',
    });

    renderPagina();
    await validarCodigo('codigo-usado');

    expect(await screen.findByText(/já utilizado/i)).toBeInTheDocument();
  });

  it('shows EVENTO_ERRADO for a ticket from a different session', async () => {
    vi.spyOn(portariaApi, 'validarIngresso').mockResolvedValue({
      resultado: 'EVENTO_ERRADO',
      assentoFileira: 'C',
      assentoNumero: 3,
      sessaoTitulo: 'Sessão errada',
    });

    renderPagina();
    await validarCodigo('codigo-outra-sessao');

    expect(await screen.findByText(/evento errado/i)).toBeInTheDocument();
  });

  it('asks the portaria to select a session first when none is active', async () => {
    vi.spyOn(portariaApi, 'validarIngresso').mockRejectedValue(
      new ApiRequestError('Selecione a sessão do turno antes de continuar', 409, 'SESSAO_ATIVA_NAO_SELECIONADA'),
    );

    renderPagina();
    await validarCodigo('qualquer-codigo');

    expect(await screen.findByRole('alert')).toHaveTextContent(/nenhuma sessão selecionada/i);
  });

  it('starts the QR scanner when the camera button is clicked', async () => {
    renderPagina();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /ligar câmera/i }));

    expect(startMock).toHaveBeenCalledTimes(1);
  });
});
