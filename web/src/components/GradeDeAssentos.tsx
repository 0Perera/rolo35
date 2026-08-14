import type { AssentoMapa } from '../api/sessoes';

// O auditório do handoff é uma caixa escura, então os assentos usam a escala escura dele em vez da
// paleta clara do resto da página. Cada estado tem matiz própria — não só luminosidade — pra que
// livre, reservado e vendido não se confundam num relance: livre é o roxo neutro do fundo,
// reservado é o azul do ciano (hold temporário, ainda pode abrir) e vendido é o cinza-vinho morto.
// Só cor: o cursor e o hover ficam de fora pra que a legenda possa reusar exatamente as mesmas
// classes do assento sem herdar comportamento de botão.
const COR_POR_STATUS: Record<AssentoMapa['status'], string> = {
  LIVRE: 'border-[#7E7686] bg-[#221D28] text-[#A79E93]',
  RESERVADO: 'border-cyan-400 bg-[#12384F] text-cyan-400',
  VENDIDO: 'border-[#6B5A62] bg-[#6B5A62] text-[#463A41]',
};

const COR_SELECIONADO =
  'border-flame-400 bg-[linear-gradient(100deg,var(--color-flame-600),var(--color-flame-400))] text-ink-950';

const COR_STATUS_DESCONHECIDO = 'border-flame-600 bg-[#221D28] text-flame-600';

// O assento cresce a partir de lg: num monitor largo a grade de 30px vira um brinquedo dentro de
// um auditório vazio, e é nela que a pessoa precisa acertar o clique.
const ASSENTO_BASE =
  'grid h-[26px] w-[30px] place-items-center rounded-t-[5px] rounded-b-[2px] border-2 p-0 font-mono text-[13px] transition-colors lg:h-[34px] lg:w-[40px] lg:text-[15px]';

const LEGENDA: { rotulo: string; cor: string }[] = [
  { rotulo: 'LIVRE', cor: COR_POR_STATUS.LIVRE },
  { rotulo: 'SELECIONADO', cor: COR_SELECIONADO },
  { rotulo: 'RESERVADO', cor: COR_POR_STATUS.RESERVADO },
  { rotulo: 'VENDIDO', cor: COR_POR_STATUS.VENDIDO },
];

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

interface GradeDeAssentosProps {
  assentos: AssentoMapa[];
  selecionados: Set<number>;
  onAlternar: (assento: AssentoMapa) => void;
}

/** Auditório: caixa escura que isola o mapa do fundo claro da página, como no handoff. */
export function GradeDeAssentos({ assentos, selecionados, onAlternar }: GradeDeAssentosProps) {
  return (
    <section className="flex-[1_1_620px] overflow-x-auto border-[3px] border-ink-950 bg-ink-950 px-[30px] pt-[34px] pb-7 shadow-[9px_9px_0_rgba(23,18,25,0.85)]">
      {/* Tela, rótulo e grade num bloco só: a curva é 70% da *grade*, não do painel, senão
          as duas larguras divergem e a tela aparece torta em cima dos assentos. w-max +
          mx-auto em vez de items-center porque, com a grade mais larga que o painel, o
          centro joga metade do excesso pra esquerda — lado que o scroll não alcança. */}
      <div className="mx-auto w-max">
        <div
          aria-hidden="true"
          className="mx-auto mb-2 h-[34px] w-[70%] border-b-[3px] border-cyan-400"
          style={{
            borderRadius: '50% 50% 6px 6px / 100% 100% 6px 6px',
            backgroundImage: 'linear-gradient(180deg, var(--color-cyan-400), rgba(126,217,242,0.05))',
          }}
        />
        <p className="mb-[30px] text-center font-mono text-xl tracking-[6px] text-cyan-400">TELA</p>

        <div className="flex flex-col gap-[9px] lg:gap-3" data-testid="grade-assentos">
          {agruparPorFileira(assentos).map(({ fileira, assentos: assentosDaFileira }) => (
            <div key={fileira} className="flex items-center gap-3">
              <div aria-hidden="true" className="w-[22px] font-display text-sm text-[#7E7686] lg:w-7 lg:text-base">
                {fileira}
              </div>
              <div className="flex gap-[7px] lg:gap-2.5">
                {assentosDaFileira.map((assento) => {
                  const selecionado = selecionados.has(assento.id);
                  const livre = assento.status === 'LIVRE';
                  const cor = selecionado
                    ? COR_SELECIONADO
                    : (COR_POR_STATUS[assento.status] ?? COR_STATUS_DESCONHECIDO);
                  // Mesma frase no title e no aria-label: a cor sozinha não diz o estado, e
                  // o leitor de tela precisa da mesma informação que o tooltip do mouse dá.
                  const descricao = `Assento ${assento.fileira}${assento.numero} — ${assento.status.toLowerCase()}`;
                  return (
                    <button
                      key={assento.id}
                      type="button"
                      title={descricao}
                      aria-label={descricao}
                      aria-pressed={selecionado}
                      data-status={assento.status}
                      disabled={!livre}
                      onClick={() => onAlternar(assento)}
                      className={`${ASSENTO_BASE} ${cor} ${livre ? 'cursor-pointer hover:border-flame-400' : 'cursor-not-allowed'}`}
                    >
                      {assento.numero}
                    </button>
                  );
                })}
              </div>
              {/* Letra repetida à direita só a partir de sm: numa fileira larga a referência
                  da esquerda fica longe de quem olha a ponta oposta, mas no mobile ela só
                  soma 34px de largura numa grade que já rola. */}
              <div
                aria-hidden="true"
                className="hidden w-[22px] font-display text-sm text-[#7E7686] sm:block lg:w-7 lg:text-base"
              >
                {fileira}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-x-[26px] gap-y-3 font-mono text-lg tracking-wide text-[#CFC5B8]">
        {LEGENDA.map(({ rotulo, cor }) => (
          <span key={rotulo} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`h-[18px] w-5 rounded-t-[4px] rounded-b-[2px] border-2 lg:h-[22px] lg:w-6 ${cor}`}
            />
            {rotulo}
          </span>
        ))}
      </div>
    </section>
  );
}
