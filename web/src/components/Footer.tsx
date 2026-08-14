import { Link } from 'react-router';

const grupoTitulo = 'font-mono text-base tracking-[2px] text-cyan-400';
/** `items-start` evita que o flex estique cada link na largura da coluna e crie área clicável invisível. */
const grupoLinks = 'mt-3 flex flex-col items-start gap-2 text-base text-paper-100/70';
const linkClass = 'py-0.5 hover:text-flame-400';

export function Footer() {
  return (
    <footer className="border-t-[3px] border-ink-950 bg-ink-950 px-5 py-10 text-paper-100 sm:px-6 sm:py-12">
      {/* A marca ocupa a linha inteira até lg; os três grupos de links fecham a linha em sm (3 colunas)
          e em mobile viram 2 colunas alinhadas. A partir de lg a marca vira a primeira coluna, mais
          larga que as de link, e tudo cabe numa faixa só. */}
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="col-span-2 sm:col-span-3 lg:col-span-1">
          <div className="font-display text-2xl tracking-wide text-flame-400 [text-shadow:2px_2px_0_var(--color-flame-600)]">
            ROLO&nbsp;35
          </div>
          <p className="mt-3 max-w-[38ch] font-mono text-lg tracking-wide text-paper-100/60">
            CINEMA DE RUA, PROJEÇÃO EM 35MM E FITAS QUE NINGUÉM MAIS TEM.
          </p>
          <div className="mt-4 h-[5px] w-40 bg-gradient-to-r from-flame-600 via-flame-400 to-cyan-400" />
        </div>

        <div>
          <div className={grupoTitulo}>INGRESSOS</div>
          <div className={grupoLinks}>
            <Link to="/" className={linkClass}>
              Em cartaz
            </Link>
          </div>
        </div>

        <div>
          <div className={grupoTitulo}>A CASA</div>
          <div className={grupoLinks}>
            <Link to="/sobre" className={linkClass}>
              Sobre o Rolo 35
            </Link>
            <Link to="/salas" className={linkClass}>
              Salas
            </Link>
          </div>
        </div>

        <div>
          <div className={grupoTitulo}>DESENVOLVEDOR</div>
          <div className={grupoLinks}>
            <a href="https://github.com/0Perera/rolo35" target="_blank" rel="noreferrer" className={linkClass}>
              GitHub
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t-2 border-white/10 pt-4 font-mono text-base tracking-wide text-paper-100/40">
        © 2026 ROLO 35 · TODOS OS DIREITOS RESERVADOS
      </div>
    </footer>
  );
}
