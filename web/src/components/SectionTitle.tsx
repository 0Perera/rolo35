import type { ReactNode } from 'react';

type Tone = 'flame' | 'ink';

interface SectionTitleProps {
  /** Linha em VT323 acima do título, no tom azul-marinho do handoff. */
  kicker?: ReactNode;
  children: ReactNode;
  tone?: Tone;
  /** Régua de gradiente abaixo do título. Some quando o título já é só um rótulo de seção. */
  rule?: boolean;
  className?: string;
}

const tones: Record<Tone, string> = {
  flame: 'text-flame-600 [text-shadow:3px_3px_0_var(--color-flame-400)]',
  ink: 'text-ink-950',
};

export function SectionTitle({ kicker, children, tone = 'flame', rule = true, className = '' }: SectionTitleProps) {
  return (
    <div className={className}>
      {kicker && <div className="font-mono text-xl tracking-[3px] text-navy-700">{kicker}</div>}
      <h1 className={`mt-1.5 font-display text-[clamp(26px,4.2cqw,42px)] leading-tight ${tones[tone]}`}>{children}</h1>
      {rule && <div className="mt-2.5 h-[5px] w-56 max-w-full bg-gradient-to-r from-flame-600 to-flame-400" />}
    </div>
  );
}
