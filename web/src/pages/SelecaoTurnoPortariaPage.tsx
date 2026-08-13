import { useEffect, useState } from 'react';
import { buscarSessaoAtiva, selecionarSessaoTurno, type SessaoAtiva } from '../api/portaria';
import { listarSessoesPublicadas, type SessaoPublicada } from '../api/sessoes';
import { PageShell } from '../components/PageShell';
import { SectionTitle } from '../components/SectionTitle';
import { SeletorDeOpcao } from '../components/SeletorDeOpcao';

type Estado = 'loading' | 'vazio' | 'erro' | 'pronto';

export function SelecaoTurnoPortariaPage() {
  const [sessoes, setSessoes] = useState<SessaoPublicada[]>([]);
  const [estado, setEstado] = useState<Estado>('loading');
  const [tentativa, setTentativa] = useState(0);
  const [sessaoAtiva, setSessaoAtiva] = useState<SessaoAtiva | null>(null);
  const [selecionando, setSelecionando] = useState(false);

  useEffect(() => {
    let ativo = true;
    setEstado('loading');
    Promise.all([listarSessoesPublicadas(), buscarSessaoAtiva()])
      .then(([sessoesResultado, sessaoAtivaResultado]) => {
        if (!ativo) {
          return;
        }
        setSessoes(sessoesResultado);
        setSessaoAtiva(sessaoAtivaResultado);
        setEstado(sessoesResultado.length === 0 ? 'vazio' : 'pronto');
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

  async function selecionar(sessaoIdTexto: string) {
    const sessaoId = Number(sessaoIdTexto);
    setSelecionando(true);
    try {
      const nova = await selecionarSessaoTurno(sessaoId);
      setSessaoAtiva(nova);
    } finally {
      setSelecionando(false);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-6">
        <SectionTitle kicker="PORTARIA">SELEÇÃO DE SESSÃO DO TURNO</SectionTitle>

        {sessaoAtiva && (
          <div className="mt-8 border-[3px] border-ink-950 bg-paper-50 p-5 shadow-[6px_6px_0_var(--color-ink-950)]">
            <span className="font-mono text-lg tracking-wide text-ink-950/60">SESSÃO ATIVA</span>
            <p className="mt-1 font-display text-2xl text-flame-600">{sessaoAtiva.titulo}</p>
            <p className="mt-1 font-mono text-base text-ink-950/70">
              {sessaoAtiva.salaNome} · {new Date(sessaoAtiva.dataHora).toLocaleString('pt-BR')}
            </p>
          </div>
        )}

        <div className="mt-8">
          {estado === 'loading' && <p className="font-mono text-lg text-ink-950/60">Carregando sessões…</p>}
          {estado === 'vazio' && <p className="font-mono text-lg text-ink-950/60">Nenhuma sessão disponível no momento.</p>}
          {estado === 'erro' && (
            <p role="alert" className="font-mono text-lg text-flame-600">
              Não foi possível carregar as sessões agora.
            </p>
          )}
          {(estado === 'erro' || estado === 'vazio') && (
            <button
              type="button"
              onClick={() => setTentativa((atual) => atual + 1)}
              className="mt-4 border-[3px] border-ink-950 bg-paper-50 px-5 py-3 font-display text-sm tracking-wide shadow-[5px_5px_0_var(--color-cyan-400)]"
            >
              TENTAR NOVAMENTE
            </button>
          )}

          {estado === 'pronto' && (
            <SeletorDeOpcao
              label={sessaoAtiva ? 'Trocar sessão do turno' : 'Selecionar sessão do turno'}
              opcoes={sessoes.map((sessao) => ({
                valor: String(sessao.id),
                rotulo: `${sessao.titulo} — ${sessao.salaNome} — ${new Date(sessao.dataHora).toLocaleString('pt-BR')}`,
              }))}
              valor={sessaoAtiva ? String(sessaoAtiva.sessaoId) : ''}
              placeholder="Escolha uma sessão"
              onEscolher={selecionar}
            />
          )}
          {selecionando && <p className="mt-2 font-mono text-base text-ink-950/60">Selecionando…</p>}
        </div>
      </div>
    </PageShell>
  );
}
