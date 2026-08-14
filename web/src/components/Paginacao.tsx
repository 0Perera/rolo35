type Tone = 'papel' | 'terminal';

interface PaginacaoProps {
  pagina: number;
  totalPaginas: number;
  onIr: (pagina: number) => void;
  tone?: Tone;
  /** Rótulo do bloco pro leitor de tela — "sessões", "filmes". */
  rotulo?: string;
}

const tones: Record<Tone, { botao: string; numero: string; atual: string; desabilitado: string }> = {
  papel: {
    botao: 'border-ink-950 bg-paper-50 text-ink-950 hover:bg-paper-100',
    numero: 'border-ink-950 bg-paper-50 text-ink-950 hover:bg-paper-100',
    atual: 'border-ink-950 bg-flame-400 text-ink-950',
    desabilitado: 'border-ink-950/30 bg-paper-50 text-ink-950/30',
  },
  terminal: {
    botao: 'border-cyan-400 bg-ink-800 text-paper-100 hover:bg-ink-700',
    numero: 'border-cyan-400 bg-ink-800 text-paper-100 hover:bg-ink-700',
    atual: 'border-cyan-400 bg-cyan-400 text-ink-950',
    desabilitado: 'border-cyan-400/30 bg-ink-800 text-paper-100/30',
  },
};

/**
 * Janela de no máximo 5 números em volta da página atual. Sem a janela, 40 páginas viram 40
 * botões e a barra passa a rolar horizontalmente — que é justamente o que a paginação evita.
 */
function janelaDePaginas(pagina: number, totalPaginas: number): number[] {
  const maximo = 5;
  if (totalPaginas <= maximo) {
    return Array.from({ length: totalPaginas }, (_, indice) => indice);
  }
  const meio = Math.floor(maximo / 2);
  const inicio = Math.min(Math.max(pagina - meio, 0), totalPaginas - maximo);
  return Array.from({ length: maximo }, (_, indice) => inicio + indice);
}

export function Paginacao({ pagina, totalPaginas, onIr, tone = 'papel', rotulo = 'resultados' }: PaginacaoProps) {
  // Uma página só não é navegação — é a lista inteira. Renderizar a barra aí só ocupa espaço.
  if (totalPaginas <= 1) {
    return null;
  }

  const pele = tones[tone];
  const temAnterior = pagina > 0;
  const temProxima = pagina < totalPaginas - 1;
  const base = 'border-[3px] px-3.5 py-2.5 font-display text-xs tracking-wide';

  return (
    <nav aria-label={`Paginação de ${rotulo}`} className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
      <button
        type="button"
        onClick={() => onIr(pagina - 1)}
        disabled={!temAnterior}
        className={`${base} ${temAnterior ? pele.botao : pele.desabilitado}`}
      >
        ◀ ANTERIOR
      </button>

      {janelaDePaginas(pagina, totalPaginas).map((numero) => (
        <button
          key={numero}
          type="button"
          onClick={() => onIr(numero)}
          // `aria-current` é o que diz "você está aqui" pro leitor de tela; a cor sozinha não diz.
          aria-current={numero === pagina ? 'page' : undefined}
          aria-label={`Página ${numero + 1}`}
          className={`${base} min-w-11 ${numero === pagina ? pele.atual : pele.numero}`}
        >
          {numero + 1}
        </button>
      ))}

      <button
        type="button"
        onClick={() => onIr(pagina + 1)}
        disabled={!temProxima}
        className={`${base} ${temProxima ? pele.botao : pele.desabilitado}`}
      >
        PRÓXIMA ▶
      </button>
    </nav>
  );
}
