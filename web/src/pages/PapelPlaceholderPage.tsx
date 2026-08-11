import { Link, useLocation } from 'react-router';
import { buttonClass } from '../components/Button';
import { Card } from '../components/Card';
import { PageShell } from '../components/PageShell';

interface PapelPlaceholderPageProps {
  titulo?: string;
  mensagem?: string;
}

export function PapelPlaceholderPage({ titulo, mensagem }: PapelPlaceholderPageProps) {
  const location = useLocation();
  const state = location.state as { titulo?: string; mensagem?: string } | null;

  const tituloFinal = titulo ?? state?.titulo ?? 'Em construção';
  const mensagemFinal =
    mensagem ?? state?.mensagem ?? 'Essa parte do Rolo 35 ainda está sendo montada. Volte em breve.';

  return (
    <PageShell variant="auth">
      <Card className="w-full max-w-md text-center">
        <h1 className="font-display text-3xl tracking-wide text-flame-500">{tituloFinal}</h1>
        <p className="mt-4 font-mono text-lg tracking-wide text-ink-950/70">{mensagemFinal}</p>
        <Link to="/" className={buttonClass('secondary', 'mt-6')}>
          VOLTAR PRA PROGRAMAÇÃO
        </Link>
      </Card>
    </PageShell>
  );
}
