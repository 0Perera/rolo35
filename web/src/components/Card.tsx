import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`border-[3px] border-ink-950 bg-paper-50 p-6 text-ink-950 shadow-[9px_9px_0_var(--color-ink-950)] ${className}`}
      {...props}
    />
  );
}
