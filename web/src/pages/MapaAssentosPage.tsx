import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiRequestError } from '../api/client';
import { buscarMapaAssentos, type AssentoMapa, type MapaAssentos } from '../api/sessoes';
import { PageShell } from '../components/PageShell';

type Estado = 'loading' | 'erro' | 'nao-encontrado' | 'pronto';

const ESTILO_POR_STATUS: Record<AssentoMapa['status'], string> = {
  LIVRE: 'border-[3px] border-cyan-400 bg-paper-50 text-ink-950',
  RESERVADO: 'border-[3px] border-ink-950 bg-ink-950/40 text-ink-950/50 cursor-not-allowed',
  VENDIDO: 'border-[3px] border-ink-950 bg-ink-950 text-paper-100/50 cursor-not-allowed',
};

function agruparPorFileira(assentos: AssentoMapa[]): { fileira: string; assentos: AssentoMapa[] }[] {
  const porFileira = new Map<string, AssentoMapa[]>();

  for (const assento of assentos) {
    const lista = porFileira.get(assento.fileira);
    if (lista) {
      lista.push(assento);
    } else {
      porFileira.set(assento.fileira, [assento]);
    }
  }

  return Array.from(porFileira.entries()).map(([fileira, assentosDaFileira]) => ({
    fileira,
    assentos: assentosDaFileira,
  }));
}

export function MapaAssentosPage() {
  const { id } = useParams<{ id: string }>();
  const [mapa, setMapa] = useState<MapaAssentos | null>(null);
  const [estado, setEstado] = useState<Estado>('loading');

  useEffect(() => {
    let ativo = true;
    setEstado('loading');
    buscarMapaAssentos(Number(id))
      .then((resultado) => {
        if (!ativo) {
          return;
        }
        setMapa(resultado);
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
  }, [id]);

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link to="/" className="font-mono text-lg tracking-wide text-ink-950/60 hover:text-flame-600">
          ◀ VOLTAR PRA PRATELEIRA
        </Link>

        {estado === 'loading' && <p className="mt-6 font-mono text-lg text-ink-950/60">Carregando…</p>}
        {estado === 'erro' && (
          <p role="alert" className="mt-6 font-mono text-lg text-flame-600">
            Não foi possível carregar o mapa de assentos agora.
          </p>
        )}
        {estado === 'nao-encontrado' && (
          <p role="alert" className="mt-6 font-mono text-lg text-flame-600">
            Sessão não encontrada.
          </p>
        )}

        {estado === 'pronto' && mapa && (
          <div className="mt-6">
            <h1 className="font-display text-[clamp(24px,3.6cqw,40px)] leading-none text-flame-600 [text-shadow:3px_3px_0_var(--color-flame-400)]">
              {mapa.titulo}
            </h1>
            <p className="mt-3 font-mono text-lg tracking-wide text-ink-950/70">
              {mapa.salaNome} ·{' '}
              {new Date(mapa.dataHora).toLocaleString('pt-BR', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              · R$ {mapa.preco.toFixed(2)}
            </p>

            <div className="my-7 h-[3px] bg-ink-950" />

            <div className="flex flex-wrap gap-4 font-mono text-sm tracking-wide text-ink-950/70">
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 border-[3px] border-cyan-400 bg-paper-50" /> livre
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 border-[3px] border-ink-950 bg-ink-950/40" /> reservado
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 border-[3px] border-ink-950 bg-ink-950" /> vendido
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-3" data-testid="grade-assentos">
              {agruparPorFileira(mapa.assentos).map(({ fileira, assentos }) => (
                <div key={fileira} className="flex flex-wrap items-center gap-3">
                  <div className="w-6 font-display text-lg">{fileira}</div>
                  <div className="flex flex-wrap gap-2">
                    {assentos.map((assento) => (
                      <div
                        key={assento.id}
                        aria-label={`Assento ${assento.fileira}${assento.numero} — ${assento.status.toLowerCase()}`}
                        data-status={assento.status}
                        className={`flex h-9 w-9 items-center justify-center font-mono text-sm ${ESTILO_POR_STATUS[assento.status]}`}
                      >
                        {assento.numero}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
