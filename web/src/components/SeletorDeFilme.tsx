import { useEffect, useRef, useState } from 'react';
import { buscarFilmes, type Filme } from '../api/filmes';

type Estado = 'ocioso' | 'buscando' | 'erro' | 'pronto';

const MINIMO_DE_CARACTERES = 2;
const ESPERA_ATE_BUSCAR_MS = 400;

interface SeletorDeFilmeProps {
  filme: Filme | null;
  onEscolher: (filme: Filme) => void;
}

/** Campo de filme do painel: abre um dropdown que busca no catálogo TMDb sem sair da tela. */
export function SeletorDeFilme({ filme, onEscolher }: SeletorDeFilmeProps) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState('');
  const [estado, setEstado] = useState<Estado>('ocioso');
  const [resultados, setResultados] = useState<Filme[]>([]);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const termoLimpo = termo.trim();
    if (termoLimpo.length < MINIMO_DE_CARACTERES) {
      setEstado('ocioso');
      setResultados([]);
      return;
    }

    let ativo = true;
    const agendado = setTimeout(() => {
      setEstado('buscando');
      buscarFilmes(termoLimpo)
        .then((encontrados) => {
          if (!ativo) {
            return;
          }
          setResultados(encontrados);
          setEstado('pronto');
        })
        .catch(() => {
          if (ativo) {
            setEstado('erro');
          }
        });
    }, ESPERA_ATE_BUSCAR_MS);

    return () => {
      ativo = false;
      clearTimeout(agendado);
    };
  }, [termo]);

  useEffect(() => {
    if (!aberto) {
      return;
    }
    function aoClicarFora(evento: MouseEvent) {
      if (!container.current?.contains(evento.target as Node)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  return (
    <div ref={container} className="relative">
      <span className="block font-mono text-lg tracking-wide text-ink-950/60">
        FILME <span className="text-sm">(catálogo TMDb)</span>
      </span>

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => setAberto((atual) => !atual)}
        className="mt-1.5 flex w-full items-center gap-2.5 border-[3px] border-ink-950 bg-paper-100 p-2 text-left"
      >
        <span className="h-12 w-8.5 shrink-0 overflow-hidden border-2 border-ink-950 bg-ink-900">
          {filme?.posterUrl && <img src={filme.posterUrl} alt="" className="h-full w-full object-cover" />}
        </span>
        <span className={`min-w-0 flex-1 truncate text-sm font-bold ${filme ? '' : 'text-ink-950/40'}`}>
          {filme ? filme.titulo : 'Escolher filme…'}
        </span>
        <span aria-hidden className="text-ink-950/60">
          ▾
        </span>
      </button>

      {aberto && (
        <div
          role="listbox"
          aria-label="Resultados da busca"
          className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto border-[3px] border-ink-950 bg-paper-50 shadow-[6px_6px_0_var(--color-ink-950)]"
        >
          <input
            type="search"
            autoFocus
            value={termo}
            onChange={(evento) => setTermo(evento.target.value)}
            placeholder="Buscar filme…"
            aria-label="Buscar filme no catálogo"
            className="w-full border-0 border-b-2 border-paper-line bg-paper-50 px-3 py-2.5 text-sm font-bold outline-none"
          />

          {estado === 'ocioso' && (
            <p className="px-3 py-3 font-mono text-base text-ink-950/60">
              Digite o nome do filme para buscar no catálogo.
            </p>
          )}
          {estado === 'buscando' && <p className="px-3 py-3 font-mono text-base text-ink-950/60">Buscando…</p>}
          {estado === 'erro' && (
            <p role="alert" className="px-3 py-3 font-mono text-base text-flame-600">
              Não foi possível buscar filmes agora.
            </p>
          )}
          {estado === 'pronto' && resultados.length === 0 && (
            <p className="px-3 py-3 font-mono text-base text-ink-950/60">Nenhum filme encontrado.</p>
          )}

          {estado === 'pronto' &&
            resultados.map((encontrado) => (
              <button
                key={encontrado.tmdbId}
                type="button"
                role="option"
                aria-selected={encontrado.tmdbId === filme?.tmdbId}
                onClick={() => {
                  onEscolher(encontrado);
                  setAberto(false);
                }}
                className="flex w-full items-center gap-2.5 border-b border-paper-line px-3 py-2 text-left hover:bg-paper-100"
              >
                <span className="h-10 w-7 shrink-0 overflow-hidden border-2 border-ink-950 bg-ink-900">
                  {encontrado.posterUrl && (
                    <img src={encontrado.posterUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold leading-tight">{encontrado.titulo}</span>
                  <span className="font-mono text-sm text-ink-950/60">
                    {encontrado.dataEstreia?.slice(0, 4) ?? '—'}
                  </span>
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
