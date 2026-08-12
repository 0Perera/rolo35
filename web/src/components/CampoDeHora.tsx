import { useRef, useState } from 'react';
import { mascararHora } from '../lib/dataHora';
import { useFecharAoClicarFora } from '../lib/useFecharAoClicarFora';

const PASSO_EM_MINUTOS = 15;

const HORARIOS = Array.from({ length: (24 * 60) / PASSO_EM_MINUTOS }, (_, indice) => {
  const minutos = indice * PASSO_EM_MINUTOS;
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
});

interface CampoDeHoraProps {
  id: string;
  label: string;
  valor: string;
  onChange: (valor: string) => void;
}

/** Campo de hora digitável, com lista de horários de 15 em 15 minutos como atalho. */
export function CampoDeHora({ id, label, valor, onChange }: CampoDeHoraProps) {
  const [aberto, setAberto] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useFecharAoClicarFora(container, aberto, () => setAberto(false));

  return (
    <div ref={container} className="relative">
      <label className="block font-mono text-lg tracking-wide text-ink-950/60" htmlFor={id}>
        {label}
      </label>
      <div className="mt-1.5 flex border-[3px] border-ink-950 bg-paper-100 focus-within:border-flame-600">
        <input
          id={id}
          inputMode="numeric"
          placeholder="hh:mm"
          value={valor}
          onChange={(evento) => onChange(mascararHora(evento.target.value))}
          className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-semibold text-ink-950 outline-none"
        />
        <button
          type="button"
          aria-label="Abrir lista de horários"
          aria-haspopup="listbox"
          aria-expanded={aberto}
          onClick={() => setAberto((atual) => !atual)}
          className="border-l-[3px] border-ink-950 px-2.5 text-ink-950/70 hover:bg-flame-400"
        >
          ▾
        </button>
      </div>

      {aberto && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-56 overflow-y-auto border-[3px] border-ink-950 bg-paper-50 shadow-[6px_6px_0_var(--color-ink-950)]"
        >
          {HORARIOS.map((horario) => (
            <button
              key={horario}
              type="button"
              role="option"
              aria-selected={horario === valor}
              ref={(elemento) => {
                if (elemento && horario === valor) {
                  elemento.scrollIntoView({ block: 'center' });
                }
              }}
              onClick={() => {
                onChange(horario);
                setAberto(false);
              }}
              className={`block w-full px-3 py-1.5 text-left font-mono text-base ${
                horario === valor ? 'bg-flame-400 font-bold' : 'hover:bg-paper-100'
              }`}
            >
              {horario}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
