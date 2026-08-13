import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router';
import { IngressoPublicoPage } from './IngressoPublicoPage';
import { ValidacaoPortariaPage } from './ValidacaoPortariaPage';
import * as ingressosApi from '../api/ingressos';
import * as portariaApi from '../api/portaria';

/**
 * Contrato entre as duas pontas do QR: o que o canhoto **grava** e o que a portaria **envia**.
 *
 * Existe porque as duas pontas já divergiram em produção uma vez: o canhoto passou a gravar
 * `${origin}/ingressos/${codigo}` (link público) enquanto `POST /api/portaria/validacoes` seguia
 * esperando `uuid.assinatura`. Resultado: toda leitura por câmera devolvia INVÁLIDO. Nenhum teste
 * pegou — o do canhoto não olhava o conteúdo do QR e o da portaria nunca acionava o `onDecode`,
 * então cada lado passava sozinho e o contrato entre eles não era coberto por ninguém.
 *
 * Por isso este arquivo testa a *travessia*, não cada lado: gera o QR pela tela real da carteira,
 * extrai o payload, e alimenta o leitor da portaria com ele.
 */

const { qrGravados, scanner } = vi.hoisted(() => ({
  qrGravados: [] as string[],
  scanner: { aoDecodificar: null as ((leitura: { data: string }) => void) | null },
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => {
    qrGravados.push(value);
    return null;
  },
}));

vi.mock('qr-scanner', () => ({
  default: vi.fn().mockImplementation(function QrScannerMock(
    _video: HTMLVideoElement,
    onDecode: (leitura: { data: string }) => void,
  ) {
    scanner.aoDecodificar = onDecode;
    return { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn(), destroy: vi.fn() };
  }),
}));

const INGRESSO_ID = '3f2a1b4c-1111-2222-3333-444455556666';
const CODIGO = `${INGRESSO_ID}.YWJjZGVmZ2hpamtsbW5vcHFy`;

/**
 * Réplica fiel de `CodigoIngressoService.extrairId()` (back-end): `split(".", 2)` e depois
 * `UUID.fromString(partes[0])`. Se esta função devolve `null`, o servidor devolve INVALIDO —
 * é a regra real, não uma aproximação. Um QR com URL cai aqui: o primeiro segmento vira
 * `https://rolo35` ou `http://localhost:5173/ingressos/<uuid>`, e nenhum dos dois é UUID.
 */
function extrairIdComoOBackendFaz(codigo: string): string | null {
  const partes = codigo.split('.');
  if (partes.length < 2) {
    return null;
  }
  const id = partes[0];
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : null;
}

/** Renderiza a tela real do ingresso e devolve o payload que o QR gravou. */
async function payloadDoQrNoCanhoto(): Promise<string> {
  vi.spyOn(ingressosApi, 'buscarIngressoPublico').mockResolvedValue({
    sessaoTitulo: 'Clube da Luta',
    salaNome: 'Sala 1',
    dataHora: '2030-01-01T20:00:00',
    status: 'VALIDO',
  });
  render(
    <MemoryRouter initialEntries={[`/ingressos/${CODIGO}`]}>
      <Routes>
        <Route path="/ingressos/:codigo" element={<IngressoPublicoPage />} />
      </Routes>
    </MemoryRouter>,
  );
  await screen.findByText('Clube da Luta');
  expect(qrGravados).toHaveLength(1);
  return qrGravados[0];
}

describe('contrato do QR entre o canhoto e a portaria', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    qrGravados.length = 0;
    scanner.aoDecodificar = null;
  });

  it('grava no QR o código assinado, nunca o link público', async () => {
    const payload = await payloadDoQrNoCanhoto();

    expect(payload).toBe(CODIGO);
    expect(payload).not.toMatch(/^https?:\/\//);
  });

  it('grava um payload que o parser do back-end consegue resolver em um UUID', async () => {
    const payload = await payloadDoQrNoCanhoto();

    // A asserção que faltava: não basta o QR existir, ele precisa ser parseável pelo servidor.
    expect(extrairIdComoOBackendFaz(payload)).toBe(INGRESSO_ID);
  });

  it('entrega à API de validação exatamente o payload que o QR carregava', async () => {
    const payload = await payloadDoQrNoCanhoto();
    const validar = vi.spyOn(portariaApi, 'validarIngresso').mockResolvedValue({
      resultado: 'VALIDO',
      assentoFileira: 'A',
      assentoNumero: 1,
      sessaoTitulo: 'Clube da Luta',
    });

    render(
      <MemoryRouter>
        <ValidacaoPortariaPage />
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByRole('button', { name: /ligar câmera/i }));

    expect(scanner.aoDecodificar).not.toBeNull();
    scanner.aoDecodificar!({ data: payload });

    // Fecha a travessia: o que o canhoto gravou é o que a portaria manda, sem transformação.
    await vi.waitFor(() => expect(validar).toHaveBeenCalledWith(payload));
    expect(extrairIdComoOBackendFaz(validar.mock.calls[0][0])).toBe(INGRESSO_ID);
  });

  it('rejeitaria um QR que voltasse a carregar a URL pública', () => {
    // Guarda explícita contra a regressão exata que aconteceu: se alguém reverter o canhoto pra
    // `urlPublicaDoIngresso(codigo)`, o payload deixa de ser resolvível e este teste explica por quê.
    const payloadAntigo = `https://rolo35.vercel.app/ingressos/${CODIGO}`;

    expect(extrairIdComoOBackendFaz(payloadAntigo)).toBeNull();
  });
});
