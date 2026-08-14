import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import App from './App';
import * as sessoesApi from './api/sessoes';
import * as reservasApi from './api/reservas';
import * as portariaApi from './api/portaria';
import { salvarSessao } from './lib/sessao';

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
    vi.spyOn(sessoesApi, 'listarSessoesParaGestao').mockResolvedValue([]);
    vi.spyOn(sessoesApi, 'listarSalas').mockResolvedValue([]);
    vi.spyOn(sessoesApi, 'listarSessoesPublicadas').mockResolvedValue({
      conteudo: [],
      pagina: 0,
      tamanho: 12,
      total: 0,
      totalPaginas: 0,
    });
    vi.spyOn(reservasApi, 'buscarReserva').mockReturnValue(new Promise(() => {}));
    vi.spyOn(portariaApi, 'buscarSessaoAtiva').mockResolvedValue(null);
    vi.spyOn(portariaApi, 'buscarPainelTurno').mockReturnValue(new Promise(() => {}));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/');
  });

  const rotasDeStaff = [
    { caminho: '/organizador', papel: 'ORGANIZADOR' as const, titulo: /programe a semana/i },
    { caminho: '/portaria', papel: 'PORTARIA' as const, titulo: /escolha a sessão pra validar/i },
    { caminho: '/portaria/validar', papel: 'PORTARIA' as const, titulo: /leitor de qr/i },
  ];

  it.each(rotasDeStaff)('sends a visitor with no session away from $caminho', ({ caminho }) => {
    abrirEm(caminho);

    expect(screen.getByRole('button', { name: /^entrar$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/e-mail/i)).toBeInTheDocument();
  });

  // O caso sem token não lê `papeis` — para no `if (!token)` antes disso. Sem um caso com sessão,
  // trocar a lista de papéis de uma rota por outra deixaria a suíte verde.
  //
  // A asserção é o título da própria página, e não a ausência do formulário de login, porque essas
  // duas coisas não são a mesma: quando a rota de destino do papel recusado é a própria rota que o
  // recusou (`rotaPorPapel('ORGANIZADOR') === '/organizador'`), o resultado é um laço de redirect
  // que também não desenha o login. Só o conteúdo certo na tela separa um caso do outro.
  it.each(rotasDeStaff)('lets $papel through to $caminho', ({ caminho, papel, titulo }) => {
    salvarSessao('token-de-teste', papel);

    abrirEm(caminho);

    expect(screen.getByText(titulo)).toBeInTheDocument();
  });

  // O outro lado da mesma lista: papel de staff errado é desviado, não recusado na tela.
  it('sends PORTARIA away from the organizador panel', () => {
    salvarSessao('token-de-teste', 'PORTARIA');

    abrirEm('/organizador');

    expect(screen.queryByText(/programe a semana/i)).not.toBeInTheDocument();
    expect(screen.getByText(/escolha a sessão pra validar/i)).toBeInTheDocument();
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
