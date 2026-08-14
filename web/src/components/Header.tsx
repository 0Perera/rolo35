import { Link, useLocation, useNavigate } from 'react-router';
import { limparSessao, useSessao } from '../lib/sessao';

function linkClass(ativo: boolean): string {
  return `border-b-2 pb-0.5 ${
    ativo ? 'border-flame-400 text-paper-100' : 'border-transparent text-paper-100/50 hover:text-flame-400'
  }`;
}

/** A borda de destaque é só cor; `aria-current` é o que diz a mesma coisa pro leitor de tela. */
function paginaAtual(ativo: boolean): 'page' | undefined {
  return ativo ? 'page' : undefined;
}

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, papel } = useSessao();

  function sair() {
    limparSessao();
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-50 bg-ink-950">
      {/* Em telas estreitas o header quebra em duas faixas: marca + ação na de cima, navegação
          na de baixo. A partir de sm tudo volta pra uma linha só, com a ação empurrada pra direita. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2.5 px-4 py-3 sm:px-6">
        <Link to="/" className="order-1 flex shrink-0 items-baseline gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-full border-[3px] border-flame-400 font-display text-xs text-flame-400 sm:h-9 sm:w-9 sm:text-sm">
            35
          </span>
          <span className="font-display text-xl tracking-wide text-flame-400 [text-shadow:2px_2px_0_var(--color-flame-600)] sm:text-2xl">
            ROLO&nbsp;35
          </span>
        </Link>

        <nav className="order-3 -mx-4 flex w-[calc(100%+2rem)] gap-4 overflow-x-auto px-4 text-xs font-bold tracking-[1.6px] whitespace-nowrap sm:order-2 sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0">
          <Link
            to="/"
            aria-current={paginaAtual(location.pathname === '/')}
            className={linkClass(location.pathname === '/')}
          >
            EM CARTAZ
          </Link>

          {papel === 'ORGANIZADOR' && (
            <Link
              to="/organizador"
              aria-current={paginaAtual(location.pathname.startsWith('/organizador'))}
              className={linkClass(location.pathname.startsWith('/organizador'))}
            >
              PAINEL
            </Link>
          )}

          {papel === 'PORTARIA' && (
            <Link
              to="/portaria"
              aria-current={paginaAtual(location.pathname.startsWith('/portaria'))}
              className={linkClass(location.pathname.startsWith('/portaria'))}
            >
              PORTARIA
            </Link>
          )}

          {papel !== 'ORGANIZADOR' && papel !== 'PORTARIA' && (
            <Link
              to="/meus-ingressos"
              aria-current={paginaAtual(location.pathname === '/meus-ingressos')}
              className={linkClass(location.pathname === '/meus-ingressos')}
            >
              MEUS INGRESSOS
            </Link>
          )}
        </nav>

        {token ? (
          <button
            type="button"
            onClick={sair}
            className="order-2 ml-auto shrink-0 border-[3px] border-ink-950 bg-paper-50 px-3 py-1.5 font-display text-[11px] tracking-wide text-ink-950 shadow-[4px_4px_0_var(--color-flame-400)] sm:order-3 sm:px-4 sm:py-2 sm:text-xs"
          >
            {papel} · SAIR
          </button>
        ) : (
          <Link
            to="/login"
            className="order-2 ml-auto shrink-0 border-[3px] border-ink-950 bg-gradient-to-r from-flame-600 via-flame-500 to-flame-400 px-3 py-1.5 font-display text-[11px] tracking-wide text-ink-950 shadow-[4px_4px_0_var(--color-ink-950)] sm:order-3 sm:px-4 sm:py-2 sm:text-xs"
          >
            ENTRAR
          </Link>
        )}
      </div>
      <div className="h-1.5 bg-gradient-to-r from-flame-600 via-flame-400 to-cyan-400" />
    </header>
  );
}
