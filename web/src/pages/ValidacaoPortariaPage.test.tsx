import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ValidacaoPortariaPage } from './ValidacaoPortariaPage';
import * as portariaApi from '../api/portaria';
import { ApiRequestError } from '../api/client';

const { startMock, stopMock, destroyMock, scanner } = vi.hoisted(() => ({
  startMock: vi.fn().mockResolvedValue(undefined),
  stopMock: vi.fn(),
  destroyMock: vi.fn(),
  scanner: { aoDecodificar: null as ((leitura: { data: string }) => void) | null },
}));

vi.mock('qr-scanner', () => ({
  default: vi.fn().mockImplementation(function QrScannerMock(
    _video: HTMLVideoElement,
    onDecode: (leitura: { data: string }) => void,
  ) {
    scanner.aoDecodificar = onDecode;
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
    startMock.mockClear().mockResolvedValue(undefined);
    stopMock.mockClear();
    destroyMock.mockClear();
    scanner.aoDecodificar = null;
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
    // Rotulado: o título é o da sessão do turno, não a do ingresso — sem o rótulo, o operador
    // lê o valor de EVENTO_ERRADO como se fosse o filme do ingresso na mão.
    expect(screen.getByText(/sessão do turno: clube da luta/i)).toBeInTheDocument();
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

  // O qr-scanner decodifica em loop (~25×/s) enquanto o QR estiver enquadrado. Sem parar na
  // primeira leitura, o mesmo ingresso é validado dezenas de vezes: a 1ª volta VALIDO e as
  // seguintes JA_UTILIZADO, invertendo o veredito na frente do operador.
  it('stops the scanner on the first read, so one ticket is validated exactly once', async () => {
    const validar = vi.spyOn(portariaApi, 'validarIngresso').mockResolvedValue({
      resultado: 'VALIDO',
      assentoFileira: 'A',
      assentoNumero: 1,
      sessaoTitulo: 'Clube da Luta',
    });

    renderPagina();
    await userEvent.setup().click(screen.getByRole('button', { name: /ligar câmera/i }));

    // Simula o loop do leitor: o mesmo código chega várias vezes seguidas.
    scanner.aoDecodificar!({ data: 'codigo-valido' });
    scanner.aoDecodificar!({ data: 'codigo-valido' });
    scanner.aoDecodificar!({ data: 'codigo-valido' });

    expect(stopMock).toHaveBeenCalled();
    await screen.findByText(/válido/i);
    expect(validar).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/já utilizado/i)).not.toBeInTheDocument();
  });

  it('shows a camera error and keeps a way back when permission is denied', async () => {
    startMock.mockRejectedValue(new Error('NotAllowedError'));

    renderPagina();
    await userEvent.setup().click(screen.getByRole('button', { name: /ligar câmera/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível abrir a câmera/i);
    // O botão precisa continuar acessível: sem isso a única saída é recarregar a página.
    expect(screen.getByRole('button', { name: /ligar câmera/i })).toBeInTheDocument();
  });

  it('clears the previous verdict before the next validation', async () => {
    vi.spyOn(portariaApi, 'validarIngresso').mockResolvedValueOnce({
      resultado: 'VALIDO',
      assentoFileira: 'A',
      assentoNumero: 1,
      sessaoTitulo: 'Clube da Luta',
    });

    renderPagina();
    await validarCodigo('primeiro-ingresso');
    expect(await screen.findByText(/válido/i)).toBeInTheDocument();

    // Segundo ingresso falha: o cartão verde do primeiro não pode sobreviver embaixo do erro.
    vi.spyOn(portariaApi, 'validarIngresso').mockRejectedValue(new Error('falha de rede'));
    await validarCodigo('segundo-ingresso');

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível validar/i);
    expect(screen.queryByText(/liberar entrada/i)).not.toBeInTheDocument();
  });
});
