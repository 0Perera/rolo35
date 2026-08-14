import type { ReactNode } from 'react';

type Tone = 'flame' | 'ink' | 'terminal';

type Tamanho = 'padrao' | 'grande';

interface SectionTitleProps {
  /** Linha em VT323 acima do título, no tom azul-marinho do handoff. */
  kicker?: ReactNode;
  children: ReactNode;
  tone?: Tone;
  /** `grande` é o título de abertura de uma seção que governa a página inteira. */
  size?: Tamanho;
  /** Régua de gradiente abaixo do título. Some quando o título já é só um rótulo de seção. */
  rule?: boolean;
  className?: string;
}

const tamanhos: Record<Tamanho, string> = {
  padrao: 'text-[clamp(26px,4.2cqw,42px)]',
  // Teto em 46px, não mais: acima disso "O QUE TÁ PASSANDO?" passa de 600px e não sobra largura
  // pros filtros na mesma faixa — o título enrola em duas linhas e a barra desmonta.
  grande: 'text-[clamp(28px,4.6cqw,46px)]',
};

const tones: Record<Tone, string> = {
  flame: 'text-flame-600 [text-shadow:3px_3px_0_var(--color-flame-400)]',
  ink: 'text-ink-950',
  // Sobre fundo escuro o par inverte: âmbar na frente, vermelho na sombra.
  terminal: 'text-flame-400 [text-shadow:3px_3px_0_var(--color-flame-600)]',
};

/** O azul-marinho do kicker some sobre o fundo do terminal; lá o contraste vem do ciano. */
const kickerTones: Record<Tone, string> = {
  flame: 'text-navy-700',
  ink: 'text-navy-700',
  terminal: 'text-cyan-400',
};

export function SectionTitle({
  kicker,
  children,
  tone = 'flame',
  size = 'padrao',
  rule = true,
  className = '',
}: SectionTitleProps) {
  return (
    <div className={className}>
      {kicker && <div className={`font-mono text-xl tracking-[3px] ${kickerTones[tone]}`}>{kicker}</div>}
      <h1 className={`mt-1.5 font-display leading-tight ${tamanhos[size]} ${tones[tone]}`}>{children}</h1>
      {rule && <div className="mt-2.5 h-[5px] w-[220px] max-w-full bg-gradient-to-r from-flame-600 to-flame-400" />}
    </div>
  );
}
