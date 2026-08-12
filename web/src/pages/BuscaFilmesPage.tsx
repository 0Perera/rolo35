import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { buscarFilmes, type Filme } from '../api/filmes';
import { Alert } from '../components/Alert';
import { Button, buttonClass } from '../components/Button';
import { PageShell } from '../components/PageShell';
import { SectionTitle } from '../components/SectionTitle';

type EstadoBusca = 'idle' | 'loading' | 'error';

export function BuscaFilmesPage() {
  const [query, setQuery] = useState('');
  const [estado, setEstado] = useState<EstadoBusca>('idle');
  const [mensagemErro, setMensagemErro] = useState('');
  const [resultados, setResultados] = useState<Filme[] | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEstado('loading');
    setMensagemErro('');
    setResultados(null);

    try {
      const filmes = await buscarFilmes(query);
      setResultados(filmes);
      setEstado('idle');
    } catch {
      setMensagemErro('Não foi possível buscar filmes agora. Tente novamente.');
      setEstado('error');
    }
  }

  return (
    <PageShell>
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionTitle kicker="PAINEL DO ORGANIZADOR" tone="ink" rule={false}>
            BUSCAR FILMES
          </SectionTitle>
          <Link to="/organizador/sessoes" className={buttonClass('secondary', 'px-4 py-2.5 text-xs')}>
            MINHAS SESSÕES
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <label className="flex flex-1 flex-col gap-1">
            <span className="sr-only">Título do filme</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Título do filme"
              required
              className="w-full border-[3px] border-ink-950 bg-paper-50 px-3 py-2.5 font-semibold text-ink-950 outline-none focus:border-flame-600"
            />
          </label>
          <Button type="submit" disabled={estado === 'loading'}>
            {estado === 'loading' ? 'BUSCANDO…' : 'BUSCAR'}
          </Button>
        </form>

        {estado === 'error' && <Alert>{mensagemErro}</Alert>}

        {estado !== 'loading' && estado !== 'error' && resultados !== null && resultados.length === 0 && (
          <p className="font-mono text-lg text-ink-950/60">Nenhum filme encontrado.</p>
        )}

        {estado !== 'loading' && resultados !== null && resultados.length > 0 && (
          <ul className="flex flex-col gap-4">
            {resultados.map((filme) => (
              <li
                key={filme.tmdbId}
                className="flex gap-4 border-[3px] border-ink-950 bg-paper-50 p-4 shadow-[6px_6px_0_var(--color-ink-950)]"
              >
                {filme.posterUrl && (
                  <img src={filme.posterUrl} alt={filme.titulo} className="h-32 w-auto border-2 border-ink-950" />
                )}
                <div className="flex flex-1 flex-col gap-1">
                  <h2 className="font-display text-xl">{filme.titulo}</h2>
                  {filme.dataEstreia && <span className="font-mono text-base text-ink-950/60">{filme.dataEstreia}</span>}
                  <p className="text-sm">{filme.sinopse}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/organizador/sessoes/nova', { state: filme })}
                    className={buttonClass('primary', 'mt-auto self-start px-4 py-2')}
                  >
                    CRIAR SESSÃO
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
