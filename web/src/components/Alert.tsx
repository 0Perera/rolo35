import type { ReactNode } from 'react';

export function Alert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="border-[3px] border-flame-600 bg-flame-600/10 px-3 py-2.5 font-mono text-lg tracking-wide text-flame-600"
    >
      ▲ {children}
    </p>
  );
}
