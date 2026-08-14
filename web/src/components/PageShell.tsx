import type { ReactNode } from 'react';

type Variant = 'public' | 'auth' | 'terminal';

const authBackground = {
  backgroundImage: 'radial-gradient(115% 80% at 50% 0%, #2A2130 0%, var(--color-ink-950) 55%, var(--color-ink-900) 100%)',
};

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
        className={`flex min-h-screen items-center justify-center px-4 py-10 font-body text-paper-100 ${className}`}
        style={authBackground}
      >
        {children}
      </main>
    );
  }

  // Portaria não é tela de público: é terminal de operação, olhado de perto numa sala escura
  // com o filme já começando. Sem grade de papel e sem fundo claro — o veredito precisa ser
  // a coisa mais brilhante em cena.
  if (variant === 'terminal') {
    return <main className={`min-h-screen bg-ink-950 font-body text-paper-100 ${className}`}>{children}</main>;
  }

  return (
    <main className={`min-h-screen bg-paper-100 font-body text-ink-950 ${className}`} style={gridBackground}>
      {children}
    </main>
  );
}
