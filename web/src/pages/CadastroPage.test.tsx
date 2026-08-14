import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CadastroPage } from './CadastroPage';
import * as authApi from '../api/auth';
import { ApiRequestError } from '../api/client';

/** Cada papel entra por uma porta diferente — é o que a navegação por `rotaPorPapel` promete. */
const destinoPorPapel = [
  { papel: 'CLIENTE' as const, rota: '/', destino: 'vitrine' },
  { papel: 'ORGANIZADOR' as const, rota: '/organizador', destino: 'painel do organizador' },
  { papel: 'PORTARIA' as const, rota: '/portaria', destino: 'terminal da portaria' },
];

function renderizar() {
  return render(
    <MemoryRouter initialEntries={['/cadastro']}>
      <Routes>
        <Route path="/cadastro" element={<CadastroPage />} />
        <Route path="/" element={<p>vitrine</p>} />
        <Route path="/organizador" element={<p>painel do organizador</p>} />
        <Route path="/portaria" element={<p>terminal da portaria</p>} />
        <Route path="/login" element={<p>tela de login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function preencher(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/nome completo/i), 'Fulano de Tal');
  await user.type(screen.getByLabelText(/e-mail/i), 'novo@rolo35.com.br');
  await user.type(screen.getByLabelText(/senha/i), 'senha123');
}

describe('CadastroPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it.each(destinoPorPapel)(
    'creates the account as $papel, stores the session and lands on $rota',
    async ({ papel, destino }) => {
      const cadastrarSpy = vi.spyOn(authApi, 'cadastrar').mockResolvedValue({ token: 'token-novo', papel });
      const user = userEvent.setup();
      renderizar();

      await preencher(user);
      await user.click(screen.getByRole('button', { name: papel }));
      await user.click(screen.getByRole('button', { name: /criar ficha/i }));

      await waitFor(() => {
        expect(cadastrarSpy).toHaveBeenCalledWith('Fulano de Tal', 'novo@rolo35.com.br', 'senha123', papel);
      });
      expect(localStorage.getItem('rolo35.token')).toBe('token-novo');
      expect(localStorage.getItem('rolo35.papel')).toBe(papel);
      expect(await screen.findByText(destino)).toBeInTheDocument();
    },
  );

  // Escolha explícita: o papel decide o que a conta pode fazer pra sempre, e nenhum botão pode
  // chegar marcado — senão a tela escolhe por quem se cadastra.
  it('starts with no papel selected and marks only the chosen one', async () => {
    const user = userEvent.setup();
    renderizar();

    for (const { papel } of destinoPorPapel) {
      expect(screen.getByRole('button', { name: papel })).toHaveAttribute('aria-pressed', 'false');
    }

    await user.click(screen.getByRole('button', { name: 'ORGANIZADOR' }));

    expect(screen.getByRole('button', { name: 'ORGANIZADOR' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'CLIENTE' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'PORTARIA' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('does not call the API when no papel was chosen', async () => {
    const cadastrarSpy = vi.spyOn(authApi, 'cadastrar');
    const user = userEvent.setup();
    renderizar();

    await preencher(user);
    await user.click(screen.getByRole('button', { name: /criar ficha/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(cadastrarSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('rolo35.token')).toBeNull();
  });

  it('does not call the API when a required field is empty', async () => {
    const cadastrarSpy = vi.spyOn(authApi, 'cadastrar');
    const user = userEvent.setup();
    renderizar();

    await user.type(screen.getByLabelText(/nome completo/i), 'Fulano de Tal');
    await user.click(screen.getByRole('button', { name: 'CLIENTE' }));
    await user.click(screen.getByRole('button', { name: /criar ficha/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Preencha nome, e-mail e senha.');
    expect(cadastrarSpy).not.toHaveBeenCalled();
  });

  // Espelha o @Size(min = 6) do back-end: a recusa é dita aqui, sem gastar uma ida ao servidor pra
  // ouvir a mesma coisa em forma de 400.
  it('does not call the API when the password is shorter than six characters', async () => {
    const cadastrarSpy = vi.spyOn(authApi, 'cadastrar');
    const user = userEvent.setup();
    renderizar();

    await user.type(screen.getByLabelText(/nome completo/i), 'Fulano de Tal');
    await user.type(screen.getByLabelText(/e-mail/i), 'novo@rolo35.com.br');
    await user.type(screen.getByLabelText(/senha/i), '12345');
    await user.click(screen.getByRole('button', { name: 'CLIENTE' }));
    await user.click(screen.getByRole('button', { name: /criar ficha/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('A senha precisa de 6 caracteres ou mais.');
    expect(cadastrarSpy).not.toHaveBeenCalled();
  });

  // Seis espaços têm length 6 mas o servidor os reprova no @NotBlank: a checagem local mede o
  // texto aparado justamente pra não gastar essa ida e volta.
  it('does not call the API when a field holds only whitespace', async () => {
    const cadastrarSpy = vi.spyOn(authApi, 'cadastrar');
    const user = userEvent.setup();
    renderizar();

    await user.type(screen.getByLabelText(/nome completo/i), 'Fulano de Tal');
    await user.type(screen.getByLabelText(/e-mail/i), 'novo@rolo35.com.br');
    await user.type(screen.getByLabelText(/senha/i), '      ');
    await user.click(screen.getByRole('button', { name: 'CLIENTE' }));
    await user.click(screen.getByRole('button', { name: /criar ficha/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Preencha nome, e-mail e senha.');
    expect(cadastrarSpy).not.toHaveBeenCalled();
  });

  // Contraprova da de cima: o mínimo de 6 é medido no texto cru, como o @Size(min = 6) do servidor.
  // A senha viaja sem ser aparada — é segredo, não identidade —, então medir o aparado recusaria
  // aqui senhas que o back aceita.
  it('accepts a password whose length only reaches six counting its spaces', async () => {
    const cadastrarSpy = vi
      .spyOn(authApi, 'cadastrar')
      .mockResolvedValue({ token: 'token-novo', papel: 'CLIENTE' });
    const user = userEvent.setup();
    renderizar();

    await user.type(screen.getByLabelText(/nome completo/i), 'Fulano de Tal');
    await user.type(screen.getByLabelText(/e-mail/i), 'novo@rolo35.com.br');
    await user.type(screen.getByLabelText(/senha/i), ' abcd ');
    await user.click(screen.getByRole('button', { name: 'CLIENTE' }));
    await user.click(screen.getByRole('button', { name: /criar ficha/i }));

    await waitFor(() => {
      expect(cadastrarSpy).toHaveBeenCalledWith('Fulano de Tal', 'novo@rolo35.com.br', ' abcd ', 'CLIENTE');
    });
  });

  it('offers the password manager a new-password field to fill', () => {
    renderizar();

    expect(screen.getByLabelText(/nome completo/i)).toHaveAttribute('autocomplete', 'name');
    expect(screen.getByLabelText(/e-mail/i)).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText(/senha/i)).toHaveAttribute('autocomplete', 'new-password');
  });

  it('clears the error message as soon as any field is typed into', async () => {
    const user = userEvent.setup();
    renderizar();

    await user.click(screen.getByRole('button', { name: /criar ficha/i }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.type(screen.getByLabelText(/nome completo/i), 'F');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the error from the API and does not get stuck loading', async () => {
    vi.spyOn(authApi, 'cadastrar').mockRejectedValue(new ApiRequestError('E-mail já cadastrado', 409));
    const user = userEvent.setup();
    renderizar();

    await preencher(user);
    await user.click(screen.getByRole('button', { name: 'CLIENTE' }));
    await user.click(screen.getByRole('button', { name: /criar ficha/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail já cadastrado');
    expect(screen.getByRole('button', { name: /criar ficha/i })).toBeEnabled();
    expect(localStorage.getItem('rolo35.token')).toBeNull();
  });
});
