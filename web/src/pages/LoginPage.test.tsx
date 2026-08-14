import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useParams } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginPage } from './LoginPage';
import * as authApi from '../api/auth';
import { ApiRequestError } from '../api/client';

/** Mostra pra onde o login mandou e o que ele levou junto — é o que a AC8 promete. */
function DestinoFalso() {
  const { id } = useParams<{ id: string }>();
  const { state } = useLocation() as { state: { assentoIds?: number[] } | null };
  return (
    <p>
      destino /sessoes/{id}/assentos com assentos {(state?.assentoIds ?? []).join(',')}
    </p>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('calls auth.login with the typed credentials and stores the token on success', async () => {
    const loginSpy = vi
      .spyOn(authApi, 'login')
      .mockResolvedValue({ token: 'token-abc', papel: 'CLIENTE' });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/e-mail/i), 'cliente1@rolo35.com.br');
    await user.type(screen.getByLabelText(/senha/i), 'cliente123');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith('cliente1@rolo35.com.br', 'cliente123');
    });
    expect(localStorage.getItem('rolo35.token')).toBe('token-abc');
    expect(localStorage.getItem('rolo35.papel')).toBe('CLIENTE');
  });

  it('shows an error message and does not get stuck loading when credentials are invalid', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(new ApiRequestError('E-mail ou senha inválidos', 401));
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/e-mail/i), 'cliente1@rolo35.com.br');
    await user.type(screen.getByLabelText(/senha/i), 'senha-errada');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos');
    expect(screen.getByRole('button', { name: /entrar/i })).toBeEnabled();
    expect(localStorage.getItem('rolo35.token')).toBeNull();
  });

  it('returns the client to where the purchase stopped, carrying the seat selection', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({ token: 'token-abc', papel: 'CLIENTE' });
    const user = userEvent.setup();

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/login', state: { retomarEm: '/sessoes/5/assentos', assentoIds: [1, 2] } },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/sessoes/:id/assentos" element={<DestinoFalso />} />
          <Route path="/" element={<p>vitrine</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/e-mail/i), 'cliente1@rolo35.com.br');
    await user.type(screen.getByLabelText(/senha/i), 'cliente123');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('destino /sessoes/5/assentos com assentos 1,2')).toBeInTheDocument();
  });

  it('ignores the pending purchase when whoever logs in is not a cliente', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({ token: 'token-abc', papel: 'ORGANIZADOR' });
    const user = userEvent.setup();

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/login', state: { retomarEm: '/sessoes/5/assentos', assentoIds: [1, 2] } },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/sessoes/:id/assentos" element={<DestinoFalso />} />
          <Route path="/organizador" element={<p>painel do organizador</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/e-mail/i), 'organizador@rolo35.com.br');
    await user.type(screen.getByLabelText(/senha/i), 'org123');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('painel do organizador')).toBeInTheDocument();
  });

  it('keeps the demo accounts collapsed until someone asks for them', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const gatilho = screen.getByRole('button', { name: /contas de demonstração/i });
    expect(gatilho).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /organizador@rolo35\.com\.br/i })).not.toBeInTheDocument();

    await user.click(gatilho);

    expect(gatilho).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /cliente1@rolo35\.com\.br/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /organizador@rolo35\.com\.br/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /portaria@rolo35\.com\.br/i })).toBeInTheDocument();

    await user.click(gatilho);

    expect(gatilho).toHaveAttribute('aria-expanded', 'false');
  });

  it('fills the form from a demo account without logging in by itself', async () => {
    const loginSpy = vi.spyOn(authApi, 'login');
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /contas de demonstração/i }));
    await user.click(screen.getByRole('button', { name: /organizador@rolo35\.com\.br/i }));

    expect(screen.getByLabelText(/e-mail/i)).toHaveValue('organizador@rolo35.com.br');
    expect(screen.getByLabelText(/senha/i)).toHaveValue('organizador123');
    expect(loginSpy).not.toHaveBeenCalled();
  });

  it('sends a demo account straight to the screen of its own papel', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({ token: 'token-abc', papel: 'PORTARIA' });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/portaria" element={<p>terminal de portaria</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /contas de demonstração/i }));
    await user.click(screen.getByRole('button', { name: /portaria@rolo35\.com\.br/i }));
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('terminal de portaria')).toBeInTheDocument();
  });

  // A conta demo é atalho de credencial, não declaração de destino. Quem clicou em comprar, tomou
  // o desvio pro login e escolheu a conta mais rápida pra entrar continua querendo comprar — mandar
  // essa pessoa pra vitrine joga a seleção de assentos fora no único ponto do fluxo em que ela é
  // difícil de refazer.
  it('resumes an interrupted purchase even when the credentials came from a demo account', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({ token: 'token-abc', papel: 'CLIENTE' });
    const user = userEvent.setup();

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/login', state: { retomarEm: '/sessoes/5/assentos', assentoIds: [1, 2] } },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/sessoes/:id/assentos" element={<DestinoFalso />} />
          <Route path="/" element={<p>vitrine</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /contas de demonstração/i }));
    await user.click(screen.getByRole('button', { name: /cliente1@rolo35\.com\.br/i }));
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('destino /sessoes/5/assentos com assentos 1,2')).toBeInTheDocument();
  });

  // O recorte por papel continua valendo, e é o que mantém os dois canais separados: entrar como
  // organizador não continua a compra de ninguém, então aí o destino da conta demo é o certo.
  it('sends a demo staff account to its own screen even with a purchase waiting', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({ token: 'token-abc', papel: 'ORGANIZADOR' });
    const user = userEvent.setup();

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/login', state: { retomarEm: '/sessoes/5/assentos', assentoIds: [1, 2] } },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/sessoes/:id/assentos" element={<DestinoFalso />} />
          <Route path="/organizador" element={<p>painel do organizador</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /contas de demonstração/i }));
    await user.click(screen.getByRole('button', { name: /organizador@rolo35\.com\.br/i }));
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('painel do organizador')).toBeInTheDocument();
  });

  it('drops the demo destination once the credentials are edited by hand', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue({ token: 'token-abc', papel: 'CLIENTE' });
    const user = userEvent.setup();

    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/login', state: { retomarEm: '/sessoes/5/assentos', assentoIds: [1, 2] } },
        ]}
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/sessoes/:id/assentos" element={<DestinoFalso />} />
          <Route path="/" element={<p>vitrine</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /contas de demonstração/i }));
    await user.click(screen.getByRole('button', { name: /cliente1@rolo35\.com\.br/i }));
    await user.clear(screen.getByLabelText(/e-mail/i));
    await user.type(screen.getByLabelText(/e-mail/i), 'cliente2@rolo35.com.br');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('destino /sessoes/5/assentos com assentos 1,2')).toBeInTheDocument();
  });

  // Teclado de celular capitaliza a primeira letra por padrão. O servidor já normaliza o e-mail
  // antes de consultar, então o login funciona de qualquer forma — mas ver "Cliente1@..." no
  // campo faz quem está tentando entrar achar que digitou errado, e corrigir à mão o que já
  // estava certo. Correção de percepção, não de funcionamento.
  it('does not let the keyboard autocapitalize or autocorrect the email field', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    const campoEmail = screen.getByLabelText(/e-mail/i);

    expect(campoEmail).toHaveAttribute('autocapitalize', 'none');
    expect(campoEmail).toHaveAttribute('autocorrect', 'off');
    expect(campoEmail).toHaveAttribute('spellcheck', 'false');
  });
});
