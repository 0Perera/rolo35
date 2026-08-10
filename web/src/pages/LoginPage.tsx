import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { login, type Papel } from '../api/auth';
import { ApiRequestError } from '../api/client';

type EstadoLogin = 'idle' | 'loading' | 'error';

export function rotaPorPapel(papel: Papel): string {
  switch (papel) {
    case 'ORGANIZADOR':
      return '/organizador';
    case 'CLIENTE':
      return '/cliente';
    case 'PORTARIA':
      return '/portaria';
  }
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [estado, setEstado] = useState<EstadoLogin>('idle');
  const [mensagemErro, setMensagemErro] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEstado('loading');
    setMensagemErro('');

    try {
      const resposta = await login(email, senha);
      localStorage.setItem('rolo35.token', resposta.token);
      localStorage.setItem('rolo35.papel', resposta.papel);
      navigate(rotaPorPapel(resposta.papel));
    } catch (error) {
      setMensagemErro(error instanceof ApiRequestError ? error.message : 'Não foi possível entrar. Tente novamente.');
      setEstado('error');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-sepia-950 px-4 font-body text-cream-100">
      <div className="w-full max-w-sm rounded border border-gold-500/40 bg-sepia-900 p-8">
        <h1 className="mb-6 font-display text-3xl tracking-wide text-amber-300">Rolo 35</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-cream-300">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="rounded border border-sepia-700 bg-sepia-950 px-3 py-2 text-cream-100 outline-none focus:border-gold-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-cream-300">Senha</span>
            <input
              type="password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              required
              className="rounded border border-sepia-700 bg-sepia-950 px-3 py-2 text-cream-100 outline-none focus:border-gold-500"
            />
          </label>

          {estado === 'error' && (
            <p role="alert" className="text-sm text-velvet-600">
              {mensagemErro}
            </p>
          )}

          <button
            type="submit"
            disabled={estado === 'loading'}
            className="mt-2 rounded bg-velvet-600 px-4 py-2 font-display tracking-wide text-cream-100 transition hover:bg-velvet-700 disabled:opacity-60"
          >
            {estado === 'loading' ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  );
}
