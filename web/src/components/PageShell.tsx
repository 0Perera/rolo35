import type { ReactNode } from 'react';

type Variant = 'public' | 'auth';

const gridBackground = {
  backgroundImage:
    'linear-gradient(var(--color-paper-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-paper-line) 1px, transparent 1px)',
  backgroundSize: '28px 28px',
};

interface PageShellProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

export function PageShell({ variant = 'public', children, className = '' }: PageShellProps) {
  if (variant === 'auth') {
    return (
      <main
        className={`flex min-h-screen items-center justify-center bg-ink-950 px-4 py-10 font-body text-paper-100 ${className}`}
      >
        {children}
      </main>
    );
  }

  return (
    <main className={`min-h-screen bg-paper-100 px-4 py-10 font-body text-ink-950 ${className}`} style={gridBackground}>
      {children}
    </main>
  );
}
