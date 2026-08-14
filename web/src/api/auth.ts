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

/**
 * A API devolve `LoginResponse` (token + papel) pra quem se cadastra: a tela usa esse token pra já
 * entrar, sem uma segunda requisição só pra repetir a senha recém-digitada.
 */
export function cadastrar(nome: string, email: string, senha: string, papel: Papel): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/cadastro', {
    method: 'POST',
    body: JSON.stringify({ nome, email, senha, papel }),
  });
}
