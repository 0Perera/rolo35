import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { buscarIngressoPublico, type IngressoPublico } from '../api/ingressos';
import { ApiRequestError } from '../api/client';
import { PageShell } from '../components/PageShell';
import { SectionTitle } from '../components/SectionTitle';
import { rotuloDeDia, rotuloDeHora } from '../lib/sessoes';

type Estado = 'loading' | 'nao-encontrado' | 'erro' | 'pronto';

export function IngressoPublicoPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [ingresso, setIngresso] = useState<IngressoPublico | null>(null);
  const [estado, setEstado] = useState<Estado>('loading');

  useEffect(() => {
    let ativo = true;
    if (!codigo) {
      setEstado('nao-encontrado');
      return;
    }
    setEstado('loading');
    buscarIngressoPublico(codigo)
      .then((resultado) => {
        if (!ativo) {
          return;
        }
        setIngresso(resultado);
        setEstado('pronto');
      })
      .catch((error: unknown) => {
        if (!ativo) {
          return;
        }
        setEstado(error instanceof ApiRequestError && error.status === 404 ? 'nao-encontrado' : 'erro');
      });
    return () => {
      ativo = false;
    };
  }, [codigo]);

  return (
    <PageShell>
      <div className="mx-auto max-w-lg px-6 py-10">
        <SectionTitle kicker="INGRESSO">ROLO 35</SectionTitle>

        {estado === 'loading' && <p className="mt-8 font-mono text-lg text-ink-950/60">Carregando…</p>}
        {estado === 'nao-encontrado' && (
          <p role="alert" className="mt-8 font-mono text-lg text-flame-600">
            Ingresso não encontrado.
          </p>
        )}
        {estado === 'erro' && (
          <p role="alert" className="mt-8 font-mono text-lg text-flame-600">
            Não foi possível carregar este ingresso agora.
          </p>
        )}

        {estado === 'pronto' && ingresso && (
          <div className="mt-8 border-[3px] border-ink-950 bg-paper-50 p-6 shadow-[9px_9px_0_var(--color-ink-950)]">
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display text-2xl leading-tight">{ingresso.sessaoTitulo}</h1>
              <span
                className={`flex-none border-2 px-2.5 py-1 font-mono text-sm tracking-wide ${
                  ingresso.status === 'VALIDO'
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-[#7E7686] text-[#7E7686]'
                }`}
              >
                {ingresso.status}
              </span>
            </div>
            <div className="my-4 h-[3px] bg-gradient-to-r from-flame-600 to-flame-400" />
            <p className="font-mono text-lg tracking-wide text-[#6D655B]">SESSÃO</p>
            <p className="mt-0.5 font-bold">
              {rotuloDeDia(ingresso.dataHora)} · {rotuloDeHora(ingresso.dataHora)}
            </p>
            <p className="mt-4 font-mono text-lg tracking-wide text-[#6D655B]">SALA</p>
            <p className="mt-0.5 font-bold">{ingresso.salaNome.toUpperCase()}</p>
          </div>
        )}
      </div>
    </PageShell>
  );
}
