import { PageShell } from '../components/PageShell';
import { SectionTitle } from '../components/SectionTitle';
import { DESTAQUES, PARAGRAFOS, type Destaque } from '../content/sobre';

const coresDeDestaque: Record<Destaque['cor'], string> = {
  flame: 'text-flame-600',
  navy: 'text-navy-700',
  amarelo: 'text-flame-400',
};

export function SobrePage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-3xl px-6 py-12">
        <SectionTitle kicker="A CASA">SOBRE O ROLO 35</SectionTitle>

        {PARAGRAFOS.map((paragrafo, indice) => (
          <p key={indice} className="mt-7 text-[17px] leading-relaxed text-pretty">
            {paragrafo.map((trecho, posicao) =>
              trecho.forte ? <strong key={posicao}>{trecho.texto}</strong> : trecho.texto,
            )}
          </p>
        ))}

        <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-[18px]">
          {DESTAQUES.map((destaque) => (
            <div
              key={destaque.descricao}
              className="border-[3px] border-ink-950 bg-paper-50 p-[18px] shadow-[5px_5px_0_var(--color-ink-950)]"
            >
              <div className={`font-display text-2xl ${coresDeDestaque[destaque.cor]}`}>{destaque.valor}</div>
              <p className="mt-1.5 font-mono text-base text-ink-950/60">{destaque.descricao}</p>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
