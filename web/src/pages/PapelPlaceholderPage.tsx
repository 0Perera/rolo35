interface PapelPlaceholderPageProps {
  titulo: string;
}

export function PapelPlaceholderPage({ titulo }: PapelPlaceholderPageProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-sepia-950 text-cream-100">
      <h1 className="font-display text-4xl tracking-wide text-amber-300">{titulo}</h1>
    </main>
  );
}
