import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listarSessoesPublicadas, type SessaoPublicada } from '../api/sessoes';
import { buttonClass } from '../components/Button';

type Estado = 'loading' | 'vazio' | 'erro' | 'pronto';

interface FilmeAgrupado {
  tmdbId: number;
  titulo: string;
  posterUrl: string | null;
  sessoes: SessaoPublicada[];
}

function agruparPorFilme(sessoes: SessaoPublicada[]): FilmeAgrupado[] {
  const porFilme = new Map<number, FilmeAgrupado>();

  for (const sessao of sessoes) {
    const existente = porFilme.get(sessao.tmdbId);
    if (existente) {
      existente.sessoes.push(sessao);
    } else {
      porFilme.set(sessao.tmdbId, {
        tmdbId: sessao.tmdbId,
        titulo: sessao.titulo,
        posterUrl: sessao.posterUrl,
        sessoes: [sessao],
      });
    }
  }

  return Array.from(porFilme.values());
}

export function ListagemSessoesPage() {
  const [sessoes, setSessoes] = useState<SessaoPublicada[]>([]);
  const [estado, setEstado] = useState<Estado>('loading');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    setEstado('loading');
    listarSessoesPublicadas()
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

  const filmes = agruparPorFilme(sessoes);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-end justify-between gap-5">
        <div>
          <h1 className="font-display text-4xl text-flame-600 [text-shadow:3px_3px_0_var(--color-flame-400)]">
            O QUE TÁ PASSANDO?
          </h1>
          <div className="mt-2.5 h-[5px] w-56 bg-gradient-to-r from-flame-600 to-flame-400" />
        </div>
      </div>

      {estado === 'loading' && <p className="mt-8 font-mono text-lg text-ink-950/60">Carregando sessões…</p>}
      {estado === 'vazio' && (
        <p className="mt-8 font-mono text-lg text-ink-950/60">Nenhuma sessão disponível no momento.</p>
      )}
      {estado === 'erro' && (
        <p role="alert" className="mt-8 font-mono text-lg text-flame-600">
          Não foi possível carregar as sessões agora.
        </p>
      )}

      {(estado === 'erro' || estado === 'vazio') && (
        <button type="button" onClick={() => setTentativa((atual) => atual + 1)} className={buttonClass('secondary', 'mt-4')}>
          TENTAR NOVAMENTE
        </button>
      )}

      {estado === 'pronto' && (
        <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-7">
          {filmes.map((filme) => {
            const esgotado = filme.sessoes.every((sessao) => sessao.esgotada);
            return (
              <Link key={filme.tmdbId} to={`/filmes/${filme.tmdbId}`} className="flex flex-col">
                <div className="relative border-[3px] border-ink-950 bg-ink-950 shadow-[7px_7px_0_rgba(23,18,25,0.85)]">
                  <div className="relative aspect-[2/3]">
                    {filme.posterUrl ? (
                      <img src={filme.posterUrl} alt={filme.titulo} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-ink-900" />
                    )}
                  </div>
                  {esgotado && (
                    <span className="absolute top-2 left-2 border-2 border-flame-600 bg-ink-950/80 px-2 py-0.5 text-xs tracking-wide text-flame-600">
                      Esgotada
                    </span>
                  )}
                </div>
                <div className="mt-3.5 font-display text-sm leading-tight">{filme.titulo}</div>
                <div className="mt-1.5 font-mono text-base tracking-wide text-ink-950/50">
                  {filme.sessoes.length === 1 ? '1 sessão' : `${filme.sessoes.length} sessões`}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
