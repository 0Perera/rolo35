import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { login, type Papel } from '../api/auth';
import { ApiRequestError } from '../api/client';
import { Alert } from '../components/Alert';
import { Button, buttonClass } from '../components/Button';
import { Card } from '../components/Card';
import { PageShell } from '../components/PageShell';
import { TextField } from '../components/TextField';
import { rotaPorPapel, salvarSessao } from '../lib/sessao';

type EstadoLogin = 'idle' | 'loading' | 'error';


/** Compra que ficou pendente no mapa de assentos por falta de login. */
interface RetomadaDeCompra {
  retomarEm: string;
  assentoIds: number[];
}

interface ContaDemo {
  email: string;
  senha: string;
  papel: Papel;
  /** Fundo da etiqueta do papel: tom do handoff que não virou token, então vai literal. */
  corEtiqueta: string;
}

/**
 * As mesmas credenciais semeadas por `V2__seed.sql` e já publicadas no README (seção "Dados de
 * teste"): o projeto é entregue como teste técnico, e quem avalia precisa dos três papéis sem
 * inventar cadastro nem sair da tela pra procurar a senha.
 */
const CONTAS_DEMO: ContaDemo[] = [
  { email: 'cliente1@rolo35.com.br', senha: 'cliente123', papel: 'CLIENTE', corEtiqueta: '#FFC414' },
  { email: 'organizador@rolo35.com.br', senha: 'organizador123', papel: 'ORGANIZADOR', corEtiqueta: '#7ED9F2' },
  { email: 'portaria@rolo35.com.br', senha: 'portaria123', papel: 'PORTARIA', corEtiqueta: '#E7DDCB' },
];

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [estado, setEstado] = useState<EstadoLogin>('idle');
  const [mensagemErro, setMensagemErro] = useState('');
  const [demoAberta, setDemoAberta] = useState(false);
  // Só roteamento: para onde ir depois do login quando a credencial veio de uma conta de
  // demonstração. Deliberadamente separado de `retomada` — ver o comentário em `handleSubmit`.
  const [destinoDemo, setDestinoDemo] = useState<string | null>(null);
  const navigate = useNavigate();
  const { state } = useLocation() as { state: Partial<RetomadaDeCompra> | null };
  const retomada: RetomadaDeCompra | null = state?.retomarEm
    ? { retomarEm: state.retomarEm, assentoIds: state.assentoIds ?? [] }
    : null;

  /** Preenche o formulário e nada mais: entrar continua sendo um clique consciente em ENTRAR. */
  function escolherContaDemo(conta: ContaDemo) {
    setEmail(conta.email);
    setSenha(conta.senha);
    setDestinoDemo(rotaPorPapel(conta.papel));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEstado('loading');
    setMensagemErro('');

    try {
      const resposta = await login(email, senha);
      salvarSessao(resposta.token, resposta.papel);
      // Compra parada vence o destino da conta demo, e só ela. A conta demo é atalho de credencial,
      // não declaração de destino: quem clicou em comprar, foi desviado pra cá e escolheu a conta
      // mais rápida pra entrar continua querendo comprar. Mandar essa pessoa pra vitrine descarta a
      // seleção de assentos no único ponto do fluxo em que refazê-la dói.
      //
      // O recorte por papel é o que mantém os dois canais separados: entrar como organizador não
      // continua a compra de ninguém, e aí o destino da conta demo segue sendo o certo.
      const compraParada = retomada !== null && retomada.assentoIds.length > 0;
      if (destinoDemo && !(compraParada && resposta.papel === 'CLIENTE')) {
        navigate(destinoDemo);
        return;
      }
      // Quem chegou aqui desviado volta pro ponto onde parou. Dois remetentes usam este canal e
      // pedem coisas diferentes: o mapa de assentos manda `assentoIds` junto (compra parada), e a
      // `RotaProtegida` manda só o caminho (rota de staff aberta direto, sem sessão).
      //
      // A compra é a única que precisa do recorte por papel: entrar como organizador não continua
      // a compra de ninguém, e mandá-lo pro mapa de assentos só adiaria a mesma negação pro clique
      // seguinte. O caminho seco vale pra qualquer papel — era estado morto pra staff, que perdia
      // o destino (e a query) e caía na casa do papel. Se o papel não puder ver a rota, a própria
      // `RotaProtegida` desvia na chegada, que é o mesmo destino de antes, um salto depois.
      if (retomada) {
        const ehCompra = retomada.assentoIds.length > 0;
        if (!ehCompra) {
          navigate(retomada.retomarEm);
          return;
        }
        if (resposta.papel === 'CLIENTE') {
          navigate(retomada.retomarEm, { state: { assentoIds: retomada.assentoIds } });
          return;
        }
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
              onChange={(event) => {
                setEmail(event.target.value);
                // Editar à mão descarta a conta demo: senão o destino escolhido lá atrás sobrevive
                // a uma credencial que já é de outra pessoa.
                setDestinoDemo(null);
              }}
              required
            />
            <TextField
              id="senha"
              label="SENHA"
              type="password"
              value={senha}
              onChange={(event) => {
                setSenha(event.target.value);
                setDestinoDemo(null);
              }}
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

          {/* Recolhido por padrão: é atalho de avaliação, não parte do caminho de quem já tem conta. */}
          <div className="mt-[14px] border-t-2 border-dashed border-[#C7B694] pt-[14px]">
            <button
              type="button"
              aria-expanded={demoAberta}
              onClick={() => setDemoAberta((atual) => !atual)}
              className="flex w-full items-center justify-between font-mono text-lg text-[#6D655B] hover:text-flame-600"
            >
              Contas de demonstração
              <span aria-hidden className="text-flame-600">
                {demoAberta ? '▴' : '▾'}
              </span>
            </button>

            {demoAberta && (
              <div className="mt-2 flex flex-col gap-2">
                {CONTAS_DEMO.map((conta) => (
                  <button
                    key={conta.email}
                    type="button"
                    // O nome visível (e-mail + papel) não diz o que o clique faz. Em leitor de tela
                    // isso vira "cliente1@rolo35.com.br CLIENTE, botão" — parece que entra na conta.
                    aria-label={`Preencher com ${conta.email} (${conta.papel})`}
                    onClick={() => escolherContaDemo(conta)}
                    className="flex items-center justify-between gap-3 border-2 border-ink-950 bg-paper-100 px-3 py-2.5 text-left hover:bg-[#FFF3D0]"
                  >
                    <span className="min-w-0 truncate font-mono text-[17px]">{conta.email}</span>
                    <span
                      className="shrink-0 border-2 border-ink-950 px-2 py-[3px] text-[10px] font-extrabold tracking-[1.2px]"
                      style={{ background: conta.corEtiqueta }}
                    >
                      {conta.papel}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
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
