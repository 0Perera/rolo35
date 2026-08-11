import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const base =
  'inline-flex items-center justify-center gap-2 border-[3px] border-ink-950 px-5 py-3 font-display text-sm tracking-wide cursor-pointer transition disabled:cursor-not-allowed disabled:opacity-60';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-flame-600 via-flame-500 to-flame-400 text-ink-950 shadow-[5px_5px_0_var(--color-ink-950)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0_var(--color-ink-950)]',
  secondary:
    'bg-paper-50 text-ink-950 shadow-[5px_5px_0_var(--color-cyan-400)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0_var(--color-cyan-400)]',
};

export function buttonClass(variant: ButtonVariant = 'primary', className = ''): string {
  return `${base} ${variants[variant]} ${className}`;
}

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  return <button className={buttonClass(variant, className)} {...props} />;
}
