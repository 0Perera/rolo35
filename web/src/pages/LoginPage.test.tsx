import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LoginPage } from './LoginPage';
import * as authApi from '../api/auth';
import { ApiRequestError } from '../api/client';

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
});
