import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ticket' | 'horario';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

// Sem padding/tipografia aqui: cada variante define os seus, pra não depender da ordem
// em que o Tailwind emite classes conflitantes (px-5 vs px-3.5, font-display vs font-body).
const base =
  'inline-flex items-center justify-center gap-2 border-[3px] border-ink-950 cursor-pointer transition disabled:cursor-not-allowed disabled:opacity-60';

const empurra =
  'hover:translate-x-[2px] hover:translate-y-[2px]';

const variants: Record<ButtonVariant, string> = {
  primary: `px-5 py-3 font-display text-sm tracking-wide bg-gradient-to-r from-flame-600 via-flame-500 to-flame-400 text-ink-950 shadow-[5px_5px_0_var(--color-ink-950)] ${empurra} hover:shadow-[3px_3px_0_var(--color-ink-950)]`,
  secondary: `px-5 py-3 font-display text-sm tracking-wide bg-paper-50 text-ink-950 shadow-[5px_5px_0_var(--color-cyan-400)] ${empurra} hover:shadow-[3px_3px_0_var(--color-cyan-400)]`,
  // CTA do pôster no grid da home: amarelo em repouso, vira o gradiente quente no hover.
  ticket: `px-3.5 py-2.5 font-body text-[11px] font-extrabold tracking-[1.6px] bg-gradient-to-r from-flame-400 to-[#F7A81B] text-ink-950 shadow-[4px_4px_0_var(--color-ink-950)] hover:from-flame-600 hover:to-flame-500 hover:text-paper-50`,
  // Cartão de horário do detalhe do filme: claro em repouso, como no protótipo.
  horario: `flex-col gap-0 px-[18px] py-3 bg-paper-50 text-ink-950 shadow-[4px_4px_0_var(--color-ink-950)] ${empurra} hover:shadow-[2px_2px_0_var(--color-ink-950)] disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[4px_4px_0_var(--color-ink-950)]`,
};

export function buttonClass(variant: ButtonVariant = 'primary', className = ''): string {
  return `${base} ${variants[variant]} ${className}`;
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={buttonClass(variant, className)} {...props} />;
}
