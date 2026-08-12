import { useEffect, useState } from 'react';
import { listarMeusIngressos, type IngressoResumo } from '../api/ingressos';
import { buttonClass } from '../components/Button';
import { PageShell } from '../components/PageShell';
import { SectionTitle } from '../components/SectionTitle';
import { rotuloDeDia, rotuloDeHora } from '../lib/sessoes';

type Estado = 'loading' | 'vazio' | 'erro' | 'pronto';

function urlPublica(codigo: string): string {
  return `${window.location.origin}/ingressos/${codigo}`;
}

function CardIngresso({ ingresso }: { ingresso: IngressoResumo }) {
  const [copiado, setCopiado] = useState(false);

  async function compartilhar() {
    const url = urlPublica(ingresso.codigo);
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard indisponível (ex.: contexto não seguro) — a URL já aparece no card.
    }
  }

  return (
    <article className="flex gap-4 border-[3px] border-ink-950 bg-paper-50 p-4 shadow-[7px_7px_0_rgba(23,18,25,0.85)]">
      <div className="h-[110px] w-[74px] flex-none overflow-hidden border-2 border-ink-950 bg-ink-900">
        {ingresso.sessaoPosterUrl && (
          <img src={ingresso.sessaoPosterUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-lg leading-tight">{ingresso.sessaoTitulo}</h2>
          <span
            className={`flex-none border-2 px-2 py-0.5 font-mono text-sm tracking-wide ${
              ingresso.status === 'VALIDO'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-[#7E7686] text-[#7E7686]'
            }`}
          >
            {ingresso.status}
          </span>
        </div>
        <p className="mt-1 font-mono text-base tracking-wide text-ink-950/60">
          {rotuloDeDia(ingresso.dataHora)} · {rotuloDeHora(ingresso.dataHora)} · {ingresso.salaNome.toUpperCase()}
        </p>
        <p className="mt-0.5 font-mono text-base tracking-wide text-ink-950/60">
          ASSENTO {ingresso.assentoFileira}
          {ingresso.assentoNumero}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-2.5 pt-3">
          <button type="button" onClick={compartilhar} className={buttonClass('secondary', 'px-4 py-2 text-xs')}>
            {copiado ? 'LINK COPIADO ✓' : 'COMPARTILHAR'}
          </button>
          <code className="min-w-0 flex-1 truncate font-mono text-sm text-ink-950/50">{urlPublica(ingresso.codigo)}</code>
        </div>
      </div>
    </article>
  );
}

export function MeusIngressosPage() {
  const [ingressos, setIngressos] = useState<IngressoResumo[]>([]);
  const [estado, setEstado] = useState<Estado>('loading');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    setEstado('loading');
    listarMeusIngressos()
      .then((resultado) => {
        if (!ativo) {
          return;
        }
        setIngressos(resultado);
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

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <SectionTitle kicker="COMPROVANTE">MEUS INGRESSOS</SectionTitle>

        {estado === 'loading' && <p className="mt-8 font-mono text-lg text-ink-950/60">Carregando…</p>}
        {estado === 'vazio' && (
          <p className="mt-8 font-mono text-lg text-ink-950/60">Você ainda não tem nenhum ingresso.</p>
        )}
        {estado === 'erro' && (
          <p role="alert" className="mt-8 font-mono text-lg text-flame-600">
            Não foi possível carregar seus ingressos agora.
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

        {estado === 'pronto' && (
          <div className="mt-8 flex flex-col gap-4">
            {ingressos.map((ingresso) => (
              <CardIngresso key={ingresso.id} ingresso={ingresso} />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
