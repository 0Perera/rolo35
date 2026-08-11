import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { buscarFilmes, type Filme } from '../api/filmes';

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
    <main className="min-h-screen bg-sepia-950 px-4 py-10 font-body text-cream-100">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl tracking-wide text-amber-300">Buscar Filmes</h1>
          <Link to="/organizador/sessoes" className="text-sm text-amber-300 underline">
            Minhas sessões
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
              className="rounded border border-sepia-700 bg-sepia-900 px-3 py-2 text-cream-100 outline-none focus:border-gold-500"
            />
          </label>
          <button
            type="submit"
            disabled={estado === 'loading'}
            className="rounded bg-velvet-600 px-4 py-2 font-display tracking-wide text-cream-100 transition hover:bg-velvet-700 disabled:opacity-60"
          >
            {estado === 'loading' ? 'Buscando…' : 'Buscar'}
          </button>
        </form>

        {estado === 'error' && (
          <p role="alert" className="text-sm text-velvet-600">
            {mensagemErro}
          </p>
        )}

        {estado !== 'loading' && estado !== 'error' && resultados !== null && resultados.length === 0 && (
          <p className="text-sm text-cream-300">Nenhum filme encontrado.</p>
        )}

        {estado !== 'loading' && resultados !== null && resultados.length > 0 && (
          <ul className="flex flex-col gap-4">
            {resultados.map((filme) => (
              <li
                key={filme.tmdbId}
                className="flex gap-4 rounded border border-gold-500/40 bg-sepia-900 p-4"
              >
                {filme.posterUrl && (
                  <img src={filme.posterUrl} alt={filme.titulo} className="h-32 w-auto rounded" />
                )}
                <div className="flex flex-1 flex-col gap-1">
                  <h2 className="font-display text-xl tracking-wide text-amber-300">{filme.titulo}</h2>
                  {filme.dataEstreia && <span className="text-sm text-cream-300">{filme.dataEstreia}</span>}
                  <p className="text-sm text-cream-100">{filme.sinopse}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/organizador/sessoes/nova', { state: filme })}
                    className="mt-auto self-start rounded bg-velvet-600 px-4 py-2 font-display tracking-wide text-cream-100 transition hover:bg-velvet-700"
                  >
                    Criar sessão
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
