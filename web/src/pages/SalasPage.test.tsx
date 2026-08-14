import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { SalasPage } from './SalasPage';

function renderPage(retomarEm?: string) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/salas', state: retomarEm ? { retomarEm } : null }]}>
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

  // Quem chega aqui pelo resumo do filme estava escolhendo sessão. Sem volta pro filme, o caminho
  // de retorno é vitrine -> filme de novo, refazendo a escolha só pra descobrir o que é a sala.
  it('goes back to the movie the visitor came from', () => {
    renderPage('/filmes/27205');

    expect(screen.getByRole('link', { name: /voltar pras sessões/i })).toHaveAttribute('href', '/filmes/27205');
  });

  // Sem origem — link do rodapé, URL colada, aba nova — a vitrine é a saída. `navigate(-1)` daria
  // botão morto justamente nesses casos, que são os que não têm histórico.
  it('falls back to the showcase when there is no origin', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /voltar pra prateleira/i })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('link', { name: /voltar pras sessões/i })).not.toBeInTheDocument();
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
