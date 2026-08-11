import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { login, type Papel } from '../api/auth';
import { ApiRequestError } from '../api/client';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PageShell } from '../components/PageShell';
import { TextField } from '../components/TextField';

type EstadoLogin = 'idle' | 'loading' | 'error';

export function rotaPorPapel(papel: Papel): string {
  switch (papel) {
    case 'ORGANIZADOR':
      return '/organizador';
    case 'CLIENTE':
      return '/';
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
    <PageShell variant="auth">
      <div className="w-full max-w-[440px]">
        <div className="mb-7 text-center">
          <div
            className="font-display text-6xl leading-none text-flame-400 [text-shadow:4px_4px_0_var(--color-flame-600),8px_8px_0_rgba(0,0,0,0.5)]"
          >
            ROLO&nbsp;35
          </div>
          <div className="mt-3 font-mono text-xl tracking-[6px] text-cyan-400">BILHETERIA · 35MM</div>
        </div>

        <Card className="p-8 shadow-[10px_10px_0_var(--color-flame-400),10px_10px_0_3px_var(--color-ink-950)]">
          <div className="font-display text-2xl">ENTRE NA SESSÃO</div>
          <div className="my-4 h-1 bg-gradient-to-r from-flame-600 via-flame-500 to-flame-400" />

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <TextField
              id="email"
              label="E-MAIL"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <TextField
              id="senha"
              label="SENHA"
              type="password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              required
            />

            {estado === 'error' && <Alert>{mensagemErro}</Alert>}

            <Button type="submit" disabled={estado === 'loading'} className="mt-2 w-full">
              {estado === 'loading' ? 'ENTRANDO…' : 'ENTRAR'}
            </Button>
          </form>
        </Card>

        <Link
          to="/"
          className="mt-5 block text-center font-mono text-xl tracking-wide text-paper-100/40 hover:text-flame-400"
        >
          só quero ver a programação ▸
        </Link>
      </div>
    </PageShell>
  );
}
