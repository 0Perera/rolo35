import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, beforeEach } from 'vitest';
import { RotaProtegida } from './RotaProtegida';
import type { Papel } from '../api/auth';

/** Espia o destino do redirecionamento e o `state` que veio junto. */
function Espia({ nome }: { nome: string }) {
  const { state } = useLocation() as { state: { retomarEm?: string } | null };
  return (
    <p>
      {nome} retomando {state?.retomarEm ?? '(nada)'}
    </p>
  );
}

function renderRota(papeis: Papel[], papel?: Papel) {
  localStorage.clear();
  if (papel) {
    localStorage.setItem('rolo35.token', 'token-abc');
    localStorage.setItem('rolo35.papel', papel);
  }
  return render(
    <MemoryRouter initialEntries={['/portaria/validar']}>
      <Routes>
        <Route
          path="/portaria/validar"
          element={
            <RotaProtegida papeis={papeis}>
              <p>terminal da portaria</p>
            </RotaProtegida>
          }
        />
        <Route path="/login" element={<Espia nome="login" />} />
        <Route path="/portaria" element={<Espia nome="portaria" />} />
        <Route path="/" element={<Espia nome="vitrine" />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RotaProtegida', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the page when the role is allowed', () => {
    renderRota(['PORTARIA'], 'PORTARIA');

    expect(screen.getByText('terminal da portaria')).toBeInTheDocument();
  });

  // Sem esse corte a tela monta, dispara a chamada e só então mostra o erro que a API devolveu —
  // quem não podia estar ali chega a ver a moldura da página antes de ser recusado.
  it('sends a visitor with no session to the login, remembering where they were going', () => {
    renderRota(['PORTARIA']);

    expect(screen.getByText(/login retomando \/portaria\/validar/)).toBeInTheDocument();
    expect(screen.queryByText('terminal da portaria')).not.toBeInTheDocument();
  });

  // Papel errado já está logado: mandar pro login pediria de novo a credencial que a pessoa
  // acabou de usar. O caminho útil é a casa do próprio papel.
  it('sends a logged-in user with the wrong role to their own home', () => {
    renderRota(['PORTARIA'], 'CLIENTE');

    expect(screen.getByText(/vitrine retomando/)).toBeInTheDocument();
    expect(screen.queryByText('terminal da portaria')).not.toBeInTheDocument();
  });
});
