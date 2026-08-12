import { useRef, useState } from 'react';
import { useFecharAoClicarFora } from '../lib/useFecharAoClicarFora';

export interface Opcao {
  valor: string;
  rotulo: string;
}

interface SeletorDeOpcaoProps {
  label: string;
  opcoes: Opcao[];
  valor: string;
  placeholder: string;
  onEscolher: (valor: string) => void;
}

/**
 * Dropdown do handoff: botão com borda grossa + painel de opções desenhado por nós.
 * Existe porque o `<select>` nativo abre o menu do sistema operacional, que destoa
 * do resto do formulário (o seletor de filme ao lado já é um painel próprio).
 */
export function SeletorDeOpcao({ label, opcoes, valor, placeholder, onEscolher }: SeletorDeOpcaoProps) {
  const [aberto, setAberto] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useFecharAoClicarFora(container, aberto, () => setAberto(false));

  const escolhida = opcoes.find((opcao) => opcao.valor === valor);

  return (
    <div ref={container} className="relative">
      <span className="block font-mono text-lg tracking-wide text-ink-950/60">{label}</span>

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-label={label}
        onClick={() => setAberto((atual) => !atual)}
        className="mt-1.5 flex w-full items-center gap-2.5 border-[3px] border-ink-950 bg-paper-100 px-2.5 py-3 text-left"
      >
        <span className={`min-w-0 flex-1 truncate text-sm font-bold ${escolhida ? '' : 'text-ink-950/40'}`}>
          {escolhida?.rotulo ?? placeholder}
        </span>
        <span aria-hidden className="text-ink-950/60">
          ▾
        </span>
      </button>

      {aberto && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-60 overflow-y-auto border-[3px] border-ink-950 bg-paper-50 shadow-[6px_6px_0_var(--color-ink-950)]"
        >
          {opcoes.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              role="option"
              aria-selected={opcao.valor === valor}
              onClick={() => {
                onEscolher(opcao.valor);
                setAberto(false);
              }}
              className="block w-full border-b border-paper-line px-3 py-2.5 text-left text-sm font-bold hover:bg-paper-100"
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
