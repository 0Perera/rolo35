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
 * A API devolve `LoginResponse` (token + papel) pra quem se cadastra, permitindo autologin. A tela
 * de cadastro opta por não usar o token e mandar a pessoa pro login — mas o contrato do endpoint é
 * esse, e o tipo de retorno o descreve como ele é.
 */
export function cadastrar(nome: string, email: string, senha: string, papel: Papel): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/api/auth/cadastro', {
    method: 'POST',
    body: JSON.stringify({ nome, email, senha, papel }),
  });
}
