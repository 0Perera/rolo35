import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { buscarSessaoAtiva, selecionarSessaoTurno, type SessaoAtiva } from '../api/portaria';
import { listarSessoesPublicadas, type SessaoPublicada } from '../api/sessoes';
import { buttonClass } from '../components/Button';
import { CampoDeBusca } from '../components/CampoDeBusca';
import { PageShell } from '../components/PageShell';
import { Paginacao } from '../components/Paginacao';
import { SectionTitle } from '../components/SectionTitle';

type Estado = 'loading' | 'erro' | 'pronto';

const TAMANHO_PAGINA = 8;

/** Um formato só na tela inteira: dia/mês e hora:minuto. Segundo não ajuda ninguém na portaria. */
function formatarQuando(dataHora: string): string {
  const data = new Date(dataHora);
  return `${data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · ${data.toLocaleTimeString(
    'pt-BR',
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

export function SelecaoTurnoPortariaPage() {
  const [parametros, setParametros] = useSearchParams();
  const busca = parametros.get('q') ?? '';
  const pagina = Number(parametros.get('pagina') ?? '0');

  const [sessoes, setSessoes] = useState<SessaoPublicada[]>([]);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [total, setTotal] = useState(0);
  const [estado, setEstado] = useState<Estado>('loading');
  const [tentativa, setTentativa] = useState(0);
  const [sessaoAtiva, setSessaoAtiva] = useState<SessaoAtiva | null>(null);
  const [selecionando, setSelecionando] = useState<number | null>(null);
  const [erroSelecao, setErroSelecao] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    setEstado('loading');
    Promise.all([
      listarSessoesPublicadas({ busca, pagina, tamanho: TAMANHO_PAGINA }),
      buscarSessaoAtiva(),
    ])
      .then(([paginaSessoes, sessaoAtivaResultado]) => {
        if (!ativo) {
          return;
        }
        setSessoes(paginaSessoes.conteudo);
        setTotalPaginas(paginaSessoes.totalPaginas);
        setTotal(paginaSessoes.total);
        setSessaoAtiva(sessaoAtivaResultado);
        setEstado('pronto');
      })
      .catch(() => {
        if (ativo) {
          setEstado('erro');
        }
      });
    return () => {
      ativo = false;
    };
  }, [busca, pagina, tentativa]);

  function irPara(novaPagina: number) {
    const proximos = new URLSearchParams(parametros);
    proximos.set('pagina', String(novaPagina));
    setParametros(proximos);
  }

  function buscar(termo: string) {
    const proximos = new URLSearchParams(parametros);
    if (termo.trim()) {
      proximos.set('q', termo.trim());
    } else {
      proximos.delete('q');
    }
    // Volta pra primeira página: manter a página 3 depois de trocar o termo costuma cair num
    // vazio que parece "não encontrei nada" quando na verdade o resultado tem uma página só.
    proximos.delete('pagina');
    setParametros(proximos);
  }

  // A sessão do turno já tem o próprio card acima. Repetir a mesma linha na lista abaixo faz o
  // mesmo filme aparecer duas vezes na tela, e nada diz ao operador qual das duas é a que vale.
  const sessoesListadas = sessoes.filter((sessao) => sessao.id !== sessaoAtiva?.sessaoId);

  async function selecionar(sessaoId: number) {
    setSelecionando(sessaoId);
    setErroSelecao(null);
    try {
      const nova = await selecionarSessaoTurno(sessaoId);
      setSessaoAtiva(nova);
    } catch {
      // Sem este catch a falha some: o painel continua mostrando a sessão anterior e a portaria
      // acredita que trocou de turno — passando a ver EVENTO_ERRADO em ingressos legítimos.
      setErroSelecao('Não foi possível trocar a sessão do turno. A sessão ativa continua a mesma.');
    } finally {
      setSelecionando(null);
    }
  }

  return (
    <PageShell variant="terminal">
      <div className="mx-auto max-w-[1080px] px-5 py-11 pb-20 sm:px-8">
        <SectionTitle kicker="TERMINAL DE PORTARIA" tone="terminal">
          ESCOLHA A SESSÃO PRA VALIDAR
        </SectionTitle>

        {/* Fora da busca e da paginação de propósito: a listagem pública só traz sessão que ainda
            vai começar, e a sessão do turno some dela no instante em que começa — que é exatamente
            quando a portaria está trabalhando. Se dependesse da lista, o turno em andamento
            desapareceria da tela no pior momento possível. */}
        {/* Faixa âmbar à esquerda e fundo próprio: é estado do turno, não mais um item de lista.
            Sem essa separação, o card e as linhas abaixo têm o mesmo peso e a tela vira duas
            listas parecidas, sem dizer qual delas é a que vale. */}
        {sessaoAtiva && (
          <div className="mt-8 border-[3px] border-flame-400 border-l-[10px] bg-ink-800 p-5">
            <span className="font-mono text-lg tracking-[2px] text-flame-400">SESSÃO ATIVA DO TURNO</span>
            <p className="mt-1 font-display text-2xl text-paper-100">{sessaoAtiva.titulo}</p>
            <p className="mt-1.5 font-mono text-lg tracking-wide text-paper-100/60">
              {sessaoAtiva.salaNome} · {formatarQuando(sessaoAtiva.dataHora)}
            </p>
            <Link to="/portaria/validar" className={buttonClass('primary', 'mt-4')}>
              VALIDAR INGRESSOS
            </Link>
          </div>
        )}

        {erroSelecao && (
          <p role="alert" className="mt-4 font-mono text-lg text-flame-400">
            {erroSelecao}
          </p>
        )}

        <h2 className="mt-10 font-mono text-xl tracking-[2px] text-paper-100/50">
          {sessaoAtiva ? 'TROCAR PARA OUTRA SESSÃO' : 'SESSÕES DISPONÍVEIS'}
        </h2>

        <CampoDeBusca
          tone="terminal"
          className="mt-4 max-w-xl"
          valor={busca}
          onBuscar={buscar}
          label="Buscar sessão"
          placeholder="Buscar por filme, sala, data ou hora…"
        />

        {estado === 'loading' && <p className="mt-6 font-mono text-lg text-paper-100/60">Carregando sessões…</p>}

        {estado === 'erro' && (
          <>
            <p role="alert" className="mt-6 font-mono text-lg text-flame-400">
              Não foi possível carregar as sessões agora.
            </p>
            <button type="button" onClick={() => setTentativa((atual) => atual + 1)} className={buttonClass('secondary', 'mt-4')}>
              TENTAR NOVAMENTE
            </button>
          </>
        )}

        {estado === 'pronto' && (
          <>
            <p className="mt-3 font-mono text-lg tracking-wide text-paper-100/50">
              {total === 1 ? '1 sessão encontrada' : `${total} sessões encontradas`}
            </p>

            {sessoesListadas.length === 0 ? (
              <p className="mt-6 font-mono text-lg text-paper-100/60">
                {busca
                  ? sessoes.length > 0
                    ? 'A única sessão encontrada é a que já está ativa acima.'
                    : `Nenhuma sessão encontrada para “${busca}”.`
                  : sessaoAtiva
                    ? 'Nenhuma outra sessão pra começar. O turno acima segue ativo.'
                    : 'Nenhuma sessão disponível no momento.'}
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-3">
                {sessoesListadas.map((sessao) => (
                  <li key={sessao.id}>
                    <button
                      type="button"
                      onClick={() => selecionar(sessao.id)}
                      disabled={selecionando !== null}
                      className="flex w-full items-center justify-between gap-4 border-[3px] border-cyan-400 bg-ink-800 px-5 py-[18px] text-left text-paper-100 hover:bg-ink-700 disabled:opacity-60"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-display text-[17px]">{sessao.titulo}</span>
                        <span className="mt-1.5 block font-mono text-lg tracking-wide text-paper-100/50">
                          {sessao.salaNome} · {formatarQuando(sessao.dataHora)}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-xl text-cyan-400">
                        {selecionando === sessao.id ? 'ABRINDO…' : 'ABRIR ▸'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <Paginacao tone="terminal" rotulo="sessões" pagina={pagina} totalPaginas={totalPaginas} onIr={irPara} />
          </>
        )}
      </div>
    </PageShell>
  );
}
