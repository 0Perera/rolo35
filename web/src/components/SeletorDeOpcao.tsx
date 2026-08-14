import { useRef, useState } from 'react';
import { useFecharAoClicarFora } from '../lib/useFecharAoClicarFora';

export interface Opcao {
  valor: string;
  rotulo: string;
}

/** `terminal` é a pele escura da portaria; `papel` é a das telas claras. */
type Tone = 'papel' | 'terminal';

/**
 * `campo` é o seletor de formulário, com rótulo visível e largura da coluna. `filtro` é o controle
 * de barra: monoespaçado, compacto e do tamanho do conteúdo, pra ficar na mesma linha de base do
 * campo de busca ao lado.
 */
type Variante = 'campo' | 'filtro';

interface SeletorDeOpcaoProps {
  label: string;
  opcoes: Opcao[];
  valor: string;
  placeholder: string;
  onEscolher: (valor: string) => void;
  tone?: Tone;
  variante?: Variante;
  /**
   * Esconde o rótulo visualmente, mantendo-o para leitor de tela. Numa barra de filtros o rótulo
   * empilhado empurra o controle pra fora do alinhamento com os vizinhos, e o próprio valor
   * escolhido ("SALA 1 — CENTRO") já diz o que o controle faz.
   */
  labelOculto?: boolean;
  className?: string;
}

/** Medidas e tipografia do handoff: gatilho em VT323 18px, opções em VT323 16px. */
const variantes: Record<Variante, { gatilho: string; texto: string; painel: string; opcao: string; seta?: string }> = {
  campo: {
    gatilho: 'mt-1.5 w-full px-2.5 py-3',
    texto: 'text-sm font-bold',
    painel: 'inset-x-0 mt-1.5',
    opcao: 'px-3 py-2.5 text-sm font-bold',
  },
  filtro: {
    gatilho: 'w-full px-3 py-2 shadow-[4px_4px_0_var(--color-ink-950)]',
    texto: 'font-mono text-lg tracking-[1px]',
    // `min-w-full` acompanha o gatilho: um painel mais largo que o botão fica pendurado pra fora e
    // parece um menu de outro controle.
    painel: 'right-0 mt-1.5 min-w-full',
    opcao: 'px-3 py-2.5 font-mono text-base tracking-[1px]',
    seta: 'text-flame-600',
  },
};

const tones: Record<Tone, { label: string; gatilho: string; placeholder: string; seta: string; painel: string; opcao: string }> = {
  papel: {
    label: 'text-ink-950/60',
    gatilho: 'border-ink-950 bg-paper-100',
    placeholder: 'text-ink-950/40',
    seta: 'text-ink-950/60',
    painel: 'border-ink-950 bg-paper-50 shadow-[6px_6px_0_var(--color-ink-950)]',
    opcao: 'border-paper-line hover:bg-paper-100',
  },
  terminal: {
    label: 'text-cyan-400',
    gatilho: 'border-cyan-400 bg-ink-800 text-paper-100',
    placeholder: 'text-paper-100/40',
    seta: 'text-cyan-400',
    painel: 'border-cyan-400 bg-ink-800 shadow-[6px_6px_0_var(--color-cyan-400)]',
    opcao: 'border-white/10 hover:bg-ink-700',
  },
};

/**
 * Dropdown do handoff: botão com borda grossa + painel de opções desenhado por nós.
 * Existe porque o `<select>` nativo abre o menu do sistema operacional, que destoa
 * do resto do formulário (o seletor de filme ao lado já é um painel próprio).
 */
export function SeletorDeOpcao({
  label,
  opcoes,
  valor,
  placeholder,
  onEscolher,
  tone = 'papel',
  variante = 'campo',
  labelOculto = false,
  className = '',
}: SeletorDeOpcaoProps) {
  const [aberto, setAberto] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useFecharAoClicarFora(container, aberto, () => setAberto(false));

  const escolhida = opcoes.find((opcao) => opcao.valor === valor);
  const pele = tones[tone];
  const forma = variantes[variante];

  return (
    <div ref={container} className={`relative ${className}`}>
      <span className={labelOculto ? 'sr-only' : `block font-mono text-lg tracking-wide ${pele.label}`}>{label}</span>

      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-label={label}
        onClick={() => setAberto((atual) => !atual)}
        className={`flex items-center gap-2.5 border-[3px] text-left ${forma.gatilho} ${pele.gatilho}`}
      >
        <span className={`min-w-0 flex-1 truncate ${forma.texto} ${escolhida ? '' : pele.placeholder}`}>
          {escolhida?.rotulo ?? placeholder}
        </span>
        <span aria-hidden className={forma.seta ?? pele.seta}>
          ▾
        </span>
      </button>

      {aberto && (
        <div
          role="listbox"
          aria-label={label}
          className={`absolute top-full z-20 max-h-60 overflow-y-auto border-[3px] ${forma.painel} ${pele.painel}`}
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
              className={`block w-full border-b text-left ${forma.opcao} ${pele.opcao}`}
            >
              {opcao.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
