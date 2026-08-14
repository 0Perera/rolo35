import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import App from './App';
import * as sessoesApi from './api/sessoes';
import * as reservasApi from './api/reservas';

/**
 * Cobre a fiação das rotas, não a guarda em si — `RotaProtegida.test.tsx` cuida do componente.
 * O que se prova aqui é que cada rota de papel está de fato embrulhada: envolver o componente e
 * esquecer de aplicá-lo numa rota é a falha silenciosa que este arquivo existe pra pegar.
 */
function abrirEm(caminho: string) {
  window.history.pushState({}, '', caminho);
  return render(<App />);
}

describe('rotas protegidas por papel', () => {
  beforeEach(() => {
    localStorage.clear();
    // Se a guarda falhar, a página protegida monta e chama a API — sem estes mocks a falha
    // apareceria como rejeição não tratada em vez da asserção que interessa.
    vi.spyOn(sessoesApi, 'listarMinhasSessoes').mockResolvedValue([]);
    vi.spyOn(sessoesApi, 'listarSalas').mockResolvedValue([]);
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue({
      conteudo: [],
      pagina: 0,
      tamanho: 12,
      total: 0,
      totalPaginas: 0,
    });
    vi.spyOn(reservasApi, 'buscarReserva').mockReturnValue(new Promise(() => {}));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  const rotasDeStaff = [
    { caminho: '/organizador', papel: 'ORGANIZADOR' as const },
    { caminho: '/portaria', papel: 'PORTARIA' as const },
    { caminho: '/portaria/validar', papel: 'PORTARIA' as const },
  ];

  it.each(rotasDeStaff)('sends a visitor with no session away from $caminho', ({ caminho }) => {
    abrirEm(caminho);

    expect(screen.getByRole('button', { name: /^entrar$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
  });

  // O checkout é do cliente: a reserva pertence a quem a fez, e o pagamento cobra dela.
  it('sends a visitor with no session away from the checkout', () => {
    abrirEm('/pagamento/42');

    expect(screen.getByRole('button', { name: /^entrar$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
  });

  // A vitrine é pública e precisa continuar sendo: a guarda nova não pode ter vazado pra ela.
  it('keeps the public listing open to visitors', () => {
    abrirEm('/');

    expect(screen.queryByLabelText(/e-mail/i)).not.toBeInTheDocument();
  });
});
