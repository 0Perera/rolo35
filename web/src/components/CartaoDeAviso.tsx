import type { ReactNode } from 'react';

interface CartaoDeAvisoProps {
  kicker: string;
  titulo: string;
  children: ReactNode;
  acoes: ReactNode;
}

/** Cartão de aviso centralizado — mesmo desenho pra recusa e pra expiração, cores diferentes. */
export function CartaoDeAviso({ kicker, titulo, children, acoes }: CartaoDeAvisoProps) {
  return (
    <div className="mx-auto max-w-[620px] px-5 pt-[60px] pb-[100px] sm:px-8">
      <div className="border-[3px] border-ink-950 bg-paper-50 p-[clamp(24px,4cqw,36px)] text-center shadow-[10px_10px_0_var(--color-flame-600)]">
        <p className="font-mono text-[22px] tracking-[4px] text-[#A8170F]">{kicker}</p>
        <h1 className="mt-3 font-display text-[clamp(24px,3.6cqw,34px)] leading-tight">{titulo}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[#4A4249]">{children}</p>
        <div className="mt-[26px] flex flex-wrap justify-center gap-3">{acoes}</div>
      </div>
    </div>
  );
}
