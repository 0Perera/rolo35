import { useMemo, useRef, useState } from 'react';
import { deDate, mascararData, paraDate } from '../lib/dataHora';
import { useFecharAoClicarFora } from '../lib/useFecharAoClicarFora';

const DIAS_DA_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

interface CampoDeDataProps {
  id: string;
  label: string;
  valor: string;
  onChange: (valor: string) => void;
}

function mesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Dias do mês precedidos das lacunas até o primeiro domingo, pra grade de 7 colunas. */
function gradeDoMes(mes: Date): (Date | null)[] {
  const primeiro = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const diasNoMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const lacunas: (Date | null)[] = Array.from({ length: primeiro.getDay() }, () => null);
  const dias = Array.from({ length: diasNoMes }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1));
  return [...lacunas, ...dias];
}

/** Campo de data digitável, com calendário próprio — o `input type=date` abre UI do navegador. */
export function CampoDeData({ id, label, valor, onChange }: CampoDeDataProps) {
  const [aberto, setAberto] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useFecharAoClicarFora(container, aberto, () => setAberto(false));

  const selecionada = paraDate(valor);
  const [mesVisivel, setMesVisivel] = useState(() => selecionada ?? new Date());
  const dias = useMemo(() => gradeDoMes(mesVisivel), [mesVisivel]);
  const hoje = new Date();

  function irParaMes(passo: number) {
    setMesVisivel((atual) => new Date(atual.getFullYear(), atual.getMonth() + passo, 1));
  }

  return (
    <div ref={container} className="relative">
      <label className="block font-mono text-lg tracking-wide text-ink-950/60" htmlFor={id}>
        {label}
      </label>
      <div className="mt-1.5 flex border-[3px] border-ink-950 bg-paper-100 focus-within:border-flame-600">
        <input
          id={id}
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          value={valor}
          onChange={(evento) => onChange(mascararData(evento.target.value))}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-semibold text-ink-950 outline-none"
        />
        <button
          type="button"
          aria-label="Abrir calendário"
          aria-haspopup="dialog"
          aria-expanded={aberto}
          onClick={() => {
            setMesVisivel(selecionada ?? new Date());
            setAberto((atual) => !atual);
          }}
          className="border-l-[3px] border-ink-950 px-2.5 text-ink-950/70 hover:bg-flame-400"
        >
          ▾
        </button>
      </div>

      {aberto && (
        <div
          role="dialog"
          aria-label="Calendário"
          className="absolute left-0 top-full z-20 mt-1.5 w-[248px] border-[3px] border-ink-950 bg-paper-50 p-3 shadow-[6px_6px_0_var(--color-ink-950)]"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Mês anterior"
              onClick={() => irParaMes(-1)}
              className="border-2 border-ink-950 px-2 font-mono hover:bg-flame-400"
            >
              ◀
            </button>
            <div className="font-mono text-base tracking-wide uppercase">
              {mesVisivel.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </div>
            <button
              type="button"
              aria-label="Próximo mês"
              onClick={() => irParaMes(1)}
              className="border-2 border-ink-950 px-2 font-mono hover:bg-flame-400"
            >
              ▶
            </button>
          </div>

          <div className="mt-2.5 grid grid-cols-7 gap-1 text-center font-mono text-sm text-ink-950/40">
            {DIAS_DA_SEMANA.map((dia, indice) => (
              <div key={`${dia}-${indice}`}>{dia}</div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {dias.map((dia, indice) =>
              dia === null ? (
                <div key={`vazio-${indice}`} />
              ) : (
                <button
                  key={dia.toISOString()}
                  type="button"
                  onClick={() => {
                    onChange(deDate(dia));
                    setAberto(false);
                  }}
                  className={`border-2 py-1 text-center font-mono text-sm ${
                    selecionada && mesmoDia(dia, selecionada)
                      ? 'border-ink-950 bg-flame-400 font-bold'
                      : mesmoDia(dia, hoje)
                        ? 'border-ink-950/40 hover:bg-paper-100'
                        : 'border-transparent hover:bg-paper-100'
                  }`}
                >
                  {dia.getDate()}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
