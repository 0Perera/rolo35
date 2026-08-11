import { Link } from 'react-router';

export function Footer() {
  return (
    <footer className="border-t-[3px] border-ink-950 bg-ink-950 px-6 py-11 text-paper-100">
      <div className="mx-auto grid max-w-6xl grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-8">
        <div>
          <div className="font-display text-2xl tracking-wide text-flame-400 [text-shadow:2px_2px_0_var(--color-flame-600)]">
            ROLO&nbsp;35
          </div>
          <p className="mt-3 max-w-[260px] font-mono text-lg tracking-wide text-paper-100/60">
            CINEMA DE RUA, PROJEÇÃO EM 35MM E FITAS QUE NINGUÉM MAIS TEM.
          </p>
          <div className="mt-4 h-[5px] w-40 bg-gradient-to-r from-flame-600 via-flame-400 to-cyan-400" />
        </div>
        <div>
          <div className="font-mono text-base tracking-[2px] text-cyan-400">INGRESSOS</div>
          <div className="mt-2 flex flex-col gap-2 text-sm text-paper-100/70">
            <Link to="/">Em cartaz</Link>
          </div>
        </div>
        <div>
          <div className="font-mono text-base tracking-[2px] text-cyan-400">A CASA</div>
          <div className="mt-2 flex flex-col gap-2 text-sm text-paper-100/70">
            <Link
              to="/em-construcao"
              state={{ titulo: 'Sobre o Rolo 35', mensagem: 'Essa página chega numa próxima entrega.' }}
            >
              Sobre o Rolo 35
            </Link>
            <Link
              to="/em-construcao"
              state={{ titulo: 'Salas', mensagem: 'O cadastro de salas ainda depende de um design próprio.' }}
            >
              Salas
            </Link>
          </div>
        </div>
        <div>
          <div className="font-mono text-base tracking-[2px] text-cyan-400">DESENVOLVEDOR</div>
          <div className="mt-2 flex flex-col gap-2 text-sm text-paper-100/70">
            <a href="https://github.com/0Perera/rolo35" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-7 max-w-6xl border-t-2 border-white/10 pt-4 font-mono text-base tracking-wide text-paper-100/40">
        © 2026 ROLO 35 · TODOS OS DIREITOS RESERVADOS
      </div>
    </footer>
  );
}
