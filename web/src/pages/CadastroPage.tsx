import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { cadastrar, type Papel } from '../api/auth';
import { ApiRequestError } from '../api/client';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PageShell } from '../components/PageShell';
import { TextField } from '../components/TextField';
import { salvarSessao } from '../lib/sessao';
import { rotaPorPapel } from './LoginPage';

type EstadoCadastro = 'idle' | 'loading' | 'error';

/** Espelha o `@Size(min = 6)` do `CadastroRequest` — mesma regra, dita antes da ida ao servidor. */
const TAMANHO_MINIMO_DA_SENHA = 6;

/**
 * CLIENTE primeiro por ser o papel de quem chega sem convite. Nenhum vem pré-selecionado: o papel
 * decide o que a conta pode fazer pra sempre (não há troca depois), e um padrão silencioso criaria
 * contas com o papel que a tela escolheu, não o que a pessoa quis.
 */
const PAPEIS: readonly Papel[] = ['CLIENTE', 'ORGANIZADOR', 'PORTARIA'];

const rotuloDeCampo = 'block font-mono text-lg tracking-wide text-ink-950/60';

function erroDePreenchimento(nome: string, email: string, senha: string): string | null {
  if (!nome.trim() || !email.trim() || !senha) {
    return 'Preencha nome, e-mail e senha.';
  }
  if (senha.length < TAMANHO_MINIMO_DA_SENHA) {
    return 'A senha precisa de 6 caracteres ou mais.';
  }
  return null;
}

export function CadastroPage() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState<Papel | null>(null);
  const [estado, setEstado] = useState<EstadoCadastro>('idle');
  const [mensagemErro, setMensagemErro] = useState('');
  const navigate = useNavigate();

  /**
   * O aviso morre no primeiro toque em qualquer campo: um erro que sobrevive à correção passa a
   * descrever um formulário que não existe mais, e quem lê não sabe se ainda vale.
   */
  function limparErro() {
    if (estado === 'error') {
      setEstado('idle');
      setMensagemErro('');
    }
  }

  function aoDigitar(definir: (valor: string) => void) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      definir(event.target.value);
      limparErro();
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Validação local antes de qualquer requisição: as mesmas regras do back-end, ditas na hora e
    // com uma frase só, em vez de um 400 com nome de campo do servidor.
    const erro = erroDePreenchimento(nome, email, senha);
    if (erro !== null) {
      setMensagemErro(erro);
      setEstado('error');
      return;
    }
    if (papel === null) {
      setMensagemErro('Escolha como você vai usar o Rolo 35.');
      setEstado('error');
      return;
    }

    setEstado('loading');
    setMensagemErro('');

    try {
      const resposta = await cadastrar(nome, email, senha, papel);
      // Cadastrar e entrar são o mesmo gesto pra quem está aqui: a API já devolve o token, então
      // pedir a senha de novo na tela seguinte seria trabalho sem função.
      salvarSessao(resposta.token, resposta.papel);
      navigate(rotaPorPapel(resposta.papel));
    } catch (error) {
      setMensagemErro(
        error instanceof ApiRequestError ? error.message : 'Não foi possível criar a ficha. Tente novamente.',
      );
      setEstado('error');
    }
  }

  return (
    <PageShell variant="auth">
      <div className="w-full max-w-[480px]">
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

        <Card className="p-[clamp(22px,4cqw,32px)] shadow-[10px_10px_0_var(--color-cyan-400),10px_10px_0_3px_var(--color-ink-950)]">
          <div className="font-display text-2xl">FICHA NOVA</div>
          <div className="mt-2 font-mono text-lg tracking-wide text-ink-950/60">
            PREENCHA COMO NA LOCADORA, EM LETRA DE FORMA
          </div>
          <div className="my-4 h-1 bg-gradient-to-r from-cyan-400 via-flame-400 to-flame-600" />

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <TextField id="nome" label="NOME COMPLETO" type="text" value={nome} onChange={aoDigitar(setNome)} />
            <TextField
              id="email"
              label="E-MAIL"
              type="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={email}
              onChange={aoDigitar(setEmail)}
            />
            <TextField id="senha" label="SENHA" type="password" value={senha} onChange={aoDigitar(setSenha)} />

            <div>
              <span id="rotulo-papel" className={rotuloDeCampo}>
                VOU USAR COMO
              </span>
              <div role="group" aria-labelledby="rotulo-papel" className="mt-1.5 flex gap-2">
                {PAPEIS.map((opcao) => {
                  const ativo = papel === opcao;
                  return (
                    <button
                      key={opcao}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => {
                        setPapel(opcao);
                        limparErro();
                      }}
                      className={`flex-1 cursor-pointer border-[3px] border-ink-950 px-2 py-2.5 font-mono text-lg tracking-wide ${
                        ativo
                          ? 'bg-[linear-gradient(100deg,var(--color-flame-600),var(--color-flame-400))] text-ink-950'
                          : 'bg-paper-100 text-ink-950/60'
                      }`}
                    >
                      {opcao}
                    </button>
                  );
                })}
              </div>
            </div>

            {estado === 'error' && <Alert>{mensagemErro}</Alert>}

            <Button type="submit" disabled={estado === 'loading'} className="mt-2 w-full">
              {estado === 'loading' ? 'CRIANDO…' : 'CRIAR FICHA'}
            </Button>
          </form>
        </Card>

        <Link
          to="/login"
          className="mt-5 block text-center font-mono text-xl tracking-wide text-paper-100/60 hover:text-flame-400"
        >
          ◂ já tenho ficha, quero entrar
        </Link>
      </div>
    </PageShell>
  );
}
