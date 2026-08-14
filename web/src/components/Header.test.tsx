import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, beforeEach } from 'vitest';
import { Header } from './Header';
import { limparSessao } from '../lib/sessao';

/** Espelha o que o header mandou pro login: a tela de onde a pessoa saiu. */
function DestinoDoLogin() {
  const { state } = useLocation() as { state: { retomarEm?: string } | null };
  return <p>login pra retomar {state?.retomarEm}</p>;
}

function renderHeader(papel?: string) {
  localStorage.clear();
  if (papel) {
    localStorage.setItem('rolo35.token', 'token-abc');
    localStorage.setItem('rolo35.papel', papel);
  }
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );
}

describe('Header', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // A carteira existe desde a Story 4.2, mas o link do menu continuou apontando pro aviso de
  // "próxima entrega" — quem clicava concluía que a feature não existe.
  it('sends the client to the wallet, not to a placeholder', () => {
    renderHeader('CLIENTE');

    expect(screen.getByRole('link', { name: /meus ingressos/i })).toHaveAttribute('href', '/meus-ingressos');
  });

  it('offers the wallet to a visitor with no session, since the page asks for login by itself', () => {
    renderHeader();

    expect(screen.getByRole('link', { name: /meus ingressos/i })).toHaveAttribute('href', '/meus-ingressos');
  });

  it('does not offer the wallet to roles that do not buy tickets', () => {
    renderHeader('ORGANIZADOR');
    expect(screen.queryByRole('link', { name: /meus ingressos/i })).not.toBeInTheDocument();

    renderHeader('PORTARIA');
    expect(screen.queryByRole('link', { name: /meus ingressos/i })).not.toBeInTheDocument();
  });

  // Quando a API recusa o token, quem limpa a sessão é o `apiFetch` — o header precisa parar de
  // anunciar "CLIENTE · SAIR" na mesma hora, senão a tela jura que a pessoa continua logada.
  it('drops the logged-in badge as soon as the session is cleared elsewhere', () => {
    renderHeader('CLIENTE');
    expect(screen.getByRole('button', { name: /CLIENTE · SAIR/i })).toBeInTheDocument();

    act(() => limparSessao());

    expect(screen.queryByRole('button', { name: /SAIR/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /entrar/i })).toBeInTheDocument();
  });

  // Sem isso, entrar pelo header devolve a pessoa na home do papel: ela clica em ENTRAR estando na
  // carteira e volta pra vitrine, tendo que refazer o caminho até a tela que pediu login.
  it('carries the current page in the login link, so the client comes back to it', async () => {
    render(
      <MemoryRouter initialEntries={['/meus-ingressos?pagina=2']}>
        <Header />
        <Routes>
          <Route path="/login" element={<DestinoDoLogin />} />
        </Routes>
      </MemoryRouter>,
    );

    await userEvent.click(screen.getByRole('link', { name: /entrar/i }));

    expect(screen.getByText('login pra retomar /meus-ingressos?pagina=2')).toBeInTheDocument();
  });

  it('marks the wallet link as the current page while the client is on it', () => {
    localStorage.setItem('rolo35.papel', 'CLIENTE');
    render(
      <MemoryRouter initialEntries={['/meus-ingressos']}>
        <Header />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /meus ingressos/i })).toHaveAttribute('aria-current', 'page');
  });
});
