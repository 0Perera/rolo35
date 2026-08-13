import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { SalasPage } from './SalasPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <SalasPage />
    </MemoryRouter>,
  );
}

describe('SalasPage', () => {
  it('lists every room with its description and capacity', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /salas/i })).toBeInTheDocument();
    expect(screen.getByText(/sala 1 — centro/i)).toBeInTheDocument();
    expect(screen.getByText(/telão grande/i)).toBeInTheDocument();
    expect(screen.getByText(/120 lugares/i)).toBeInTheDocument();
    expect(screen.getByText(/sala 2 — drive-in/i)).toBeInTheDocument();
    expect(screen.getByText(/80 lugares/i)).toBeInTheDocument();
    expect(screen.getByText(/sala 3 — vhs club/i)).toBeInTheDocument();
    expect(screen.getByText(/60 lugares/i)).toBeInTheDocument();
  });

  // A página é conteúdo institucional, não leitura do cadastro: nenhuma sala aqui vem do banco,
  // então nem chega a existir uma requisição pra falhar ou pra deixar a tela em carregamento.
  it('does not reach the API at all', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    renderPage();

    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
