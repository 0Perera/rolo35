import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, beforeEach } from 'vitest';
import { Header } from './Header';

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
