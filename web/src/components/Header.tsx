import { Link, useLocation, useNavigate } from 'react-router';
import type { Papel } from '../api/auth';

function lerSessao(): { token: string | null; papel: Papel | null } {
  return {
    token: localStorage.getItem('rolo35.token'),
    papel: localStorage.getItem('rolo35.papel') as Papel | null,
  };
}

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, papel } = lerSessao();

  function sair() {
    localStorage.removeItem('rolo35.token');
    localStorage.removeItem('rolo35.papel');
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-50 bg-ink-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-6 py-3">
        <Link to="/" className="flex items-baseline gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-full border-[3px] border-flame-400 font-display text-sm text-flame-400">
            35
          </span>
          <span className="font-display text-2xl tracking-wide text-flame-400 [text-shadow:2px_2px_0_var(--color-flame-600)]">
            ROLO&nbsp;35
          </span>
        </Link>

        <nav className="flex flex-wrap gap-4 text-xs font-bold tracking-[1.6px]">
          <Link
            to="/"
            className={`border-b-2 pb-0.5 ${
              location.pathname === '/' ? 'border-flame-400 text-paper-100' : 'border-transparent text-paper-100/50'
            }`}
          >
            EM CARTAZ
          </Link>
          <Link
            to="/em-construcao"
            state={{ titulo: 'Meus Ingressos', mensagem: 'A carteira de ingressos chega numa próxima entrega.' }}
            className="border-b-2 border-transparent pb-0.5 text-paper-100/50 hover:text-flame-400"
          >
            MEUS INGRESSOS
          </Link>
        </nav>

        <div className="flex-1" />

        {token ? (
          <button
            type="button"
            onClick={sair}
            className="border-[3px] border-ink-950 bg-paper-50 px-4 py-2 font-display text-xs tracking-wide text-ink-950 shadow-[4px_4px_0_var(--color-flame-400)]"
          >
            {papel} · SAIR
          </button>
        ) : (
          <Link
            to="/login"
            className="border-[3px] border-ink-950 bg-gradient-to-r from-flame-600 via-flame-500 to-flame-400 px-4 py-2 font-display text-xs tracking-wide text-ink-950 shadow-[4px_4px_0_var(--color-ink-950)]"
          >
            ENTRAR
          </Link>
        )}
      </div>
      <div className="h-1.5 bg-gradient-to-r from-flame-600 via-flame-400 to-cyan-400" />
    </header>
  );
}
