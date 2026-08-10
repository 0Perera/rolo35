import { apiFetch } from './client';

export type Papel = 'ORGANIZADOR' | 'CLIENTE' | 'PORTARIA';

export interface LoginResponse {
  token: string;
  papel: Papel;
}

export function login(email: string, senha: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  });
}
