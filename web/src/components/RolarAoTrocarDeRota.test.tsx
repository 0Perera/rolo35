import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate, useSearchParams } from 'react-router';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { RolarAoTrocarDeRota } from './RolarAoTrocarDeRota';

function Vitrine() {
  const [, setParametros] = useSearchParams();
  const navegar = useNavigate();
  return (
    <>
      <button type="button" onClick={() => setParametros(new URLSearchParams({ sala: '2' }))}>
        filtrar
      </button>
      <button type="button" onClick={() => navegar('/outra')}>
        ir pra outra tela
      </button>
    </>
  );
}

function renderApp() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <RolarAoTrocarDeRota />
      <Routes>
        <Route path="/" element={<Vitrine />} />
        <Route path="/outra" element={<p>outra tela</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RolarAoTrocarDeRota', () => {
  let scrollTo: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Busca, filtro e paginação vivem na query string. Sem distinguir caminho de query, escolher uma
  // sala no meio da vitrine jogava o visitante de volta pro topo, longe da grade que ele lia.
  it('does not scroll when only the query string changes', async () => {
    renderApp();

    await userEvent.click(document.querySelector('button')!);

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('scrolls to the top when the pathname changes', async () => {
    renderApp();

    await userEvent.click(document.querySelectorAll('button')[1]!);

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  // Na primeira renderização a página já está no topo; rolar de novo é ruído — e atrapalha quem
  // chegou por um link com âncora.
  it('does not scroll on the first render', () => {
    renderApp();

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
