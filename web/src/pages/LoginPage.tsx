import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { login, type Papel } from '../api/auth';
import { ApiRequestError } from '../api/client';
import { Alert } from '../components/Alert';
import { Button, buttonClass } from '../components/Button';
import { Card } from '../components/Card';
import { PageShell } from '../components/PageShell';
import { TextField } from '../components/TextField';
import { salvarSessao } from '../lib/sessao';

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

/** Compra que ficou pendente no mapa de assentos por falta de login. */
interface RetomadaDeCompra {
  retomarEm: string;
  assentoIds: number[];
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [estado, setEstado] = useState<EstadoLogin>('idle');
  const [mensagemErro, setMensagemErro] = useState('');
  const navigate = useNavigate();
  const { state } = useLocation() as { state: Partial<RetomadaDeCompra> | null };
  const retomada: RetomadaDeCompra | null = state?.retomarEm
    ? { retomarEm: state.retomarEm, assentoIds: state.assentoIds ?? [] }
    : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEstado('loading');
    setMensagemErro('');

    try {
      const resposta = await login(email, senha);
      salvarSessao(resposta.token, resposta.papel);
      // Compra interrompida por falta de login volta pro ponto onde parou. Só pra CLIENTE: entrar
      // com outro papel não continua uma compra, e mandar um organizador pro mapa de assentos só
      // adiaria a mesma negação pro clique seguinte.
      if (retomada && resposta.papel === 'CLIENTE') {
        navigate(retomada.retomarEm, { state: { assentoIds: retomada.assentoIds } });
        return;
      }
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
            aria-hidden
            className="h-[14px] [box-shadow:0_0_24px_rgba(255,196,20,0.35)]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 50% 50%, #FFC414 3.5px, rgba(255,196,20,0.18) 4.5px, transparent 5px)',
              backgroundSize: '24px 14px',
            }}
          />
          <div className="mt-4 font-display text-[clamp(38px,7cqw,62px)] leading-[0.9] text-flame-400 [text-shadow:4px_4px_0_var(--color-flame-600),8px_8px_0_rgba(0,0,0,0.5)]">
            ROLO&nbsp;35
          </div>
          <div className="mt-3 font-mono text-xl tracking-[6px] text-cyan-400">BILHETERIA · 35MM</div>
        </div>

        <Card className="p-[clamp(22px,4cqw,32px)] shadow-[10px_10px_0_var(--color-flame-400),10px_10px_0_3px_var(--color-ink-950)]">
          <div className="font-display text-2xl">ENTRE NA SESSÃO</div>
          <div className="my-4 h-1 bg-gradient-to-r from-flame-600 via-flame-500 to-flame-400" />

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <TextField
              id="email"
              label="E-MAIL"
              type="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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

          <div className="my-5 flex items-center gap-3">
            <div className="h-[3px] flex-1 bg-paper-line" />
            <div className="font-mono text-lg text-ink-950/40">OU</div>
            <div className="h-[3px] flex-1 bg-paper-line" />
          </div>
          <Link to="/cadastro" className={buttonClass('secondary', 'w-full')}>
            CRIAR MINHA FICHA
          </Link>
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
