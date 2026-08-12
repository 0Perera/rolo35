import type { InputHTMLAttributes, ReactNode } from 'react';

const labelClass = 'block font-mono text-lg tracking-wide text-ink-950/60';
// O ícone de calendário/relógio dos inputs nativos vem colorido pelo navegador e destoa do
// resto do formulário; o filtro deixa ele monocromático, na cor da tinta do tema.
const iconeNativo =
  '[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:grayscale';
const controlClass = `mt-1.5 w-full border-[3px] border-ink-950 bg-paper-100 px-3 py-2.5 font-semibold text-ink-950 outline-none focus:border-flame-600 focus:bg-paper-50 ${iconeNativo}`;

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
}

export function TextField({ label, className = '', id, ...props }: TextFieldProps) {
  return (
    <label className="block" htmlFor={id}>
      <span className={labelClass}>{label}</span>
      <input id={id} className={`${controlClass} ${className}`} {...props} />
    </label>
  );
}

