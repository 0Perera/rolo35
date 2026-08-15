import { Link } from 'react-router';
import {
  contagemDeSessoes,
  precoDoFilme,
  resumoDeSalas,
  rotuloDeDia,
  rotuloDeHora,
  type FilmeAgrupado,
} from '../lib/sessoes';
import { buttonClass } from './Button';

const PALETA_ACENTO = ['#F26522', '#E32B21', '#2E7D46', '#7ED9F2', '#FFC414', '#E85D9E', '#8A8F98', '#123A5C'];

function corPorFilme(tmdbId: number): string {
  return PALETA_ACENTO[Math.abs(tmdbId) % PALETA_ACENTO.length];
}

/** "A partir de" só entra quando o filme tem sessões com preços diferentes. */
function precoDoCard(filme: FilmeAgrupado): string {
  const preco = precoDoFilme(filme.sessoes);
  return preco.aPartirDe ? `A PARTIR DE ${preco.texto}` : preco.texto;
}

/** Ano de estreia, sala e nº de sessões — o que o snapshot do TMDb em `sessoes` permite mostrar. */
function metaDoFilme(filme: FilmeAgrupado): string {
  return [filme.dataEstreia?.slice(0, 4), resumoDeSalas(filme.sessoes), contagemDeSessoes(filme.sessoes.length)]
    .filter(Boolean)
    .join(' · ');
}

export function CardDeFilme({ filme }: { filme: FilmeAgrupado }) {
  const esgotado = filme.sessoes.every((sessao) => sessao.esgotada);

  return (
    <article className="flex h-full flex-col">
      <Link
        to={`/filmes/${filme.tmdbId}`}
        aria-label={filme.titulo}
        className="relative block border-[3px] border-ink-950 bg-ink-950 shadow-[7px_7px_0_rgba(23,18,25,0.85)] transition hover:-translate-x-0.5 hover:-translate-y-[3px]"
      >
        <div className="relative aspect-[2/3] w-full overflow-hidden">
          {filme.posterUrl ? (
            <img src={filme.posterUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-ink-900" />
          )}
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 w-3.5"
            style={{ backgroundImage: 'linear-gradient(90deg, rgba(0,0,0,0.55), transparent)' }}
          />
        </div>
        <div
          aria-hidden
          className="absolute bottom-0 left-0 right-0 h-1.5"
          style={{ background: corPorFilme(filme.tmdbId) }}
        />
        {esgotado && (
          <span className="absolute top-2 left-2 border-2 border-flame-600 bg-ink-950/80 px-2 py-0.5 text-xs tracking-wide text-flame-600">
            Esgotada
          </span>
        )}
      </Link>

      <h2 className="mt-3.5 font-display text-sm leading-tight tracking-[0.3px]">{filme.titulo}</h2>
      <p className="mt-1.5 font-mono text-base leading-snug tracking-wide text-ink-950/50">{metaDoFilme(filme)}</p>
      <p className="mb-3 font-mono text-base leading-snug tracking-wide text-navy-700">
        {rotuloDeDia(filme.sessoes[0].dataHora)} · {rotuloDeHora(filme.sessoes[0].dataHora)} · {precoDoCard(filme)}
      </p>

      <Link to={`/filmes/${filme.tmdbId}`} className={buttonClass('ticket', 'mt-auto w-full')}>
        {esgotado ? 'VER SESSÕES' : 'COMPRAR INGRESSO'}
      </Link>
    </article>
  );
}
