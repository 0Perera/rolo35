import { useEffect, useState } from 'react';
import { listarMinhasSessoes, listarSalas, type Sala, type SessaoGestao } from '../api/sessoes';
import { buttonClass } from '../components/Button';
import { FormSessao } from '../components/FormSessao';
import { PageShell } from '../components/PageShell';
import { SectionTitle } from '../components/SectionTitle';

type Estado = 'loading' | 'vazio' | 'erro' | 'pronto';

const COLUNAS = '1.6fr 1fr 0.9fr 0.8fr 0.8fr 0.7fr 1fr';
/** Abaixo disso a tabela rola em vez de espremer as colunas — cabe inteira no desktop. */
const LARGURA_MINIMA_DA_TABELA = 640;

export function GerenciarSessoesPage() {
  const [sessoes, setSessoes] = useState<SessaoGestao[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [estado, setEstado] = useState<Estado>('loading');
  const [tentativa, setTentativa] = useState(0);
  const [emEdicao, setEmEdicao] = useState<SessaoGestao | null>(null);

  useEffect(() => {
    let ativo = true;
    setEstado('loading');
    listarMinhasSessoes()
      .then((resultado) => {
        if (!ativo) {
          return;
        }
        setSessoes(resultado);
        setEstado(resultado.length === 0 ? 'vazio' : 'pronto');
      })
      .catch(() => {
        if (ativo) {
          setEstado('erro');
        }
      });
    return () => {
      ativo = false;
    };
  }, [tentativa]);

  // Salas carregam à parte: elas alimentam o formulário, e uma falha aqui não pode
  // derrubar a listagem de sessões, que é o conteúdo principal da tela.
  useEffect(() => {
    let ativo = true;
    listarSalas()
      .then((carregadas) => {
        if (ativo) {
          setSalas(carregadas);
        }
      })
      .catch(() => {
        if (ativo) {
          setSalas([]);
        }
      });
    return () => {
      ativo = false;
    };
  }, [tentativa]);

  function recarregar() {
    setEmEdicao(null);
    setTentativa((atual) => atual + 1);
  }

  // Trava pós-venda da Story 2.2: sessão com ingresso confirmado chega com `editavel: false`.
  const travadas = sessoes.filter((sessao) => !sessao.editavel).length;

  return (
    <PageShell>
      <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <SectionTitle kicker="PAINEL DO ORGANIZADOR" tone="ink" rule={false}>
            PROGRAME A SEMANA
          </SectionTitle>
          <div className="flex flex-wrap gap-3.5">
            <div className="border-[3px] border-ink-950 bg-paper-50 px-[18px] py-3 shadow-[5px_5px_0_var(--color-ink-950)]">
              <div className="font-mono text-base tracking-wide text-ink-950/60">SESSÕES ATIVAS</div>
              <div className="font-display text-2xl">{sessoes.length}</div>
            </div>
            <div className="border-[3px] border-ink-950 bg-gradient-to-r from-flame-400 to-[#F7A81B] px-[18px] py-3 shadow-[5px_5px_0_var(--color-ink-950)]">
              <div className="font-mono text-base tracking-wide text-[#6B4E00]">TRAVADAS PÓS-VENDA</div>
              <div className="font-display text-2xl">{travadas}</div>
            </div>
          </div>
        </div>

        <div className="mt-9 flex flex-wrap items-start gap-8">
          <FormSessao
            salas={salas}
            emEdicao={emEdicao}
            onSalvou={recarregar}
            onCancelarEdicao={() => setEmEdicao(null)}
          />

          <div className="min-w-0 flex-[3_1_460px]">
            <div className="mb-3 inline-block border-b-[3px] border-flame-600 pb-3 font-mono text-lg tracking-wide">
              MINHAS SESSÕES
            </div>

            {estado === 'loading' && <p className="font-mono text-lg text-ink-950/60">Carregando sessões…</p>}
            {estado === 'vazio' && (
              <p className="font-mono text-lg text-ink-950/60">Você ainda não criou nenhuma sessão.</p>
            )}
            {estado === 'erro' && (
              <p role="alert" className="font-mono text-lg text-flame-600">
                Não foi possível carregar suas sessões agora.
              </p>
            )}

            {(estado === 'erro' || estado === 'vazio') && (
              <button
                type="button"
                onClick={() => setTentativa((atual) => atual + 1)}
                className={buttonClass('secondary', 'mt-4')}
              >
                TENTAR NOVAMENTE
              </button>
            )}

            {/* Como no protótipo, a tabela mantém as colunas em qualquer largura: em telas
                estreitas ela rola na horizontal dentro do próprio quadro, sem virar cartão. */}
            {estado === 'pronto' && (
              <div className="overflow-x-auto border-[3px] border-ink-950 bg-paper-50 shadow-[9px_9px_0_var(--color-ink-950)]">
                <div
                  className="grid gap-3 bg-ink-950 px-5 py-3.5 font-mono text-lg tracking-wide text-flame-400"
                  style={{ gridTemplateColumns: COLUNAS, minWidth: LARGURA_MINIMA_DA_TABELA }}
                >
                  <div>FILME</div>
                  <div>SALA</div>
                  <div>DATA</div>
                  <div>HORA</div>
                  <div>LUGARES</div>
                  <div>R$</div>
                  <div>AÇÃO</div>
                </div>
                {sessoes.map((sessao) => {
                  const data = new Date(sessao.dataHora);
                  const emFoco = emEdicao?.id === sessao.id;
                  return (
                    <div
                      key={sessao.id}
                      className={`grid items-center gap-3 border-b-2 border-paper-line px-5 py-4 text-sm font-semibold ${
                        emFoco ? 'bg-flame-400/15' : ''
                      }`}
                      style={{ gridTemplateColumns: COLUNAS, minWidth: LARGURA_MINIMA_DA_TABELA }}
                    >
                      <div className="flex flex-wrap items-center gap-2 font-display text-sm leading-tight">
                        {sessao.titulo}
                        {!sessao.editavel && (
                          <span className="border-2 border-flame-600 px-2 py-0.5 text-xs tracking-wide text-flame-600">
                            Travada
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-base text-ink-950/60">{sessao.salaNome}</div>
                      <div className="font-mono text-base">{data.toLocaleDateString('pt-BR')}</div>
                      <div className="font-mono text-base">
                        {data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="font-mono text-base text-ink-950/60">{sessao.capacidade}</div>
                      <div className="font-display text-flame-600">{sessao.preco.toFixed(2).replace('.', ',')}</div>
                      <div>
                        {sessao.editavel ? (
                          <button type="button" onClick={() => setEmEdicao(sessao)} className={buttonClass('discreto')}>
                            ✎ EDITAR
                          </button>
                        ) : (
                          <span
                            className="inline-flex items-center gap-2 whitespace-nowrap border-2 border-ink-950/15 px-2.5 py-1.5 font-mono text-base tracking-wide text-ink-950/35"
                            title="Sessão com ingresso vendido não pode ser editada."
                          >
                            ✎ EDITAR
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
