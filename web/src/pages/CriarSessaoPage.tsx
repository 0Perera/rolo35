import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { ApiRequestError } from '../api/client';
import type { Filme } from '../api/filmes';
import { criarSessao, listarSalas, type Sala, type Sessao } from '../api/sessoes';

type EstadoSalas = 'loading' | 'vazio' | 'erro' | 'pronto';
type EstadoSubmit = 'idle' | 'loading' | 'sucesso' | 'erro';

export function CriarSessaoPage() {
  const location = useLocation();
  const filme = location.state as Filme | null;

  const [salas, setSalas] = useState<Sala[]>([]);
  const [estadoSalas, setEstadoSalas] = useState<EstadoSalas>('loading');
  const [salaId, setSalaId] = useState('');
  const [dataHora, setDataHora] = useState('');
  const [preco, setPreco] = useState('');
  const [estadoSubmit, setEstadoSubmit] = useState<EstadoSubmit>('idle');
  const [mensagemErro, setMensagemErro] = useState('');
  const [sessaoCriada, setSessaoCriada] = useState<Sessao | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!filme) {
      return;
    }
    let ativo = true;
    setEstadoSalas('loading');
    listarSalas()
      .then((resultado) => {
        if (!ativo) {
          return;
        }
        setSalas(resultado);
        setEstadoSalas(resultado.length === 0 ? 'vazio' : 'pronto');
      })
      .catch(() => {
        if (ativo) {
          setEstadoSalas('erro');
        }
      });
    return () => {
      ativo = false;
    };
  }, [filme, tentativa]);

  if (!filme) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sepia-950 px-4 font-body text-cream-100">
        <p className="text-sm text-cream-300">
          Nenhum filme selecionado. Volte pra{' '}
          <Link to="/organizador" className="text-amber-300 underline">
            busca de filmes
          </Link>{' '}
          e escolha um filme pra criar a sessão.
        </p>
      </main>
    );
  }

  // O form usa noValidate (mesmo padrão de LoginPage, pra manter a mensagem de erro no mesmo
  // lugar da tela), então required/min/step não valem nada — a checagem precisa existir aqui.
  // Sem ela, campo em branco vira salaId: 0 e o usuário recebe "Sala não encontrada".
  function primeiroErroDeValidacao(): string | null {
    if (!salaId) {
      return 'Selecione uma sala.';
    }
    if (!dataHora) {
      return 'Informe a data e a hora da sessão.';
    }
    if (!preco || Number(preco) <= 0) {
      return 'Informe um preço maior que zero.';
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!filme) {
      return;
    }

    const erroDeValidacao = primeiroErroDeValidacao();
    if (erroDeValidacao) {
      setMensagemErro(erroDeValidacao);
      setEstadoSubmit('erro');
      return;
    }

    setEstadoSubmit('loading');
    setMensagemErro('');

    try {
      const sessao = await criarSessao({
        salaId: Number(salaId),
        tmdbId: filme.tmdbId,
        titulo: filme.titulo,
        posterUrl: filme.posterUrl,
        sinopse: filme.sinopse,
        dataEstreia: filme.dataEstreia,
        dataHora: dataHora.length === 16 ? `${dataHora}:00` : dataHora,
        preco: Number(preco),
      });
      setSessaoCriada(sessao);
      setEstadoSubmit('sucesso');
    } catch (error) {
      setMensagemErro(
        error instanceof ApiRequestError ? error.message : 'Não foi possível criar a sessão. Tente novamente.',
      );
      setEstadoSubmit('erro');
    }
  }

  if (estadoSubmit === 'sucesso' && sessaoCriada) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sepia-950 px-4 font-body text-cream-100">
        <div className="w-full max-w-sm rounded border border-gold-500/40 bg-sepia-900 p-8 text-center">
          <h1 className="mb-4 font-display text-2xl tracking-wide text-amber-300">Sessão criada!</h1>
          <p className="mb-6 text-sm text-cream-100">
            {sessaoCriada.titulo} — {sessaoCriada.salaNome} — capacidade {sessaoCriada.capacidade}
          </p>
          <Link to="/organizador" className="text-amber-300 underline">
            Voltar à busca
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-sepia-950 px-4 py-10 font-body text-cream-100">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <h1 className="font-display text-3xl tracking-wide text-amber-300">Criar sessão — {filme.titulo}</h1>

        {estadoSalas === 'loading' && <p className="text-sm text-cream-300">Carregando salas…</p>}
        {estadoSalas === 'vazio' && <p className="text-sm text-cream-300">Nenhuma sala cadastrada.</p>}
        {estadoSalas === 'erro' && (
          <p role="alert" className="text-sm text-velvet-600">
            Não foi possível carregar as salas agora.
          </p>
        )}

        {(estadoSalas === 'erro' || estadoSalas === 'vazio') && (
          <button
            type="button"
            onClick={() => setTentativa((atual) => atual + 1)}
            className="self-start rounded border border-gold-500/60 px-4 py-2 font-display tracking-wide text-amber-300 transition hover:bg-sepia-900"
          >
            Tentar novamente
          </button>
        )}

        {estadoSalas === 'pronto' && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-cream-300">Sala</span>
              <select
                value={salaId}
                onChange={(event) => setSalaId(event.target.value)}
                required
                className="rounded border border-sepia-700 bg-sepia-950 px-3 py-2 text-cream-100 outline-none focus:border-gold-500"
              >
                <option value="" disabled>
                  Selecione uma sala
                </option>
                {salas.map((sala) => (
                  <option key={sala.id} value={sala.id}>
                    {sala.nome} ({sala.capacidade} assentos)
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-cream-300">Data e hora</span>
              <input
                type="datetime-local"
                value={dataHora}
                onChange={(event) => setDataHora(event.target.value)}
                required
                className="rounded border border-sepia-700 bg-sepia-950 px-3 py-2 text-cream-100 outline-none focus:border-gold-500"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm text-cream-300">Preço</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={preco}
                onChange={(event) => setPreco(event.target.value)}
                required
                className="rounded border border-sepia-700 bg-sepia-950 px-3 py-2 text-cream-100 outline-none focus:border-gold-500"
              />
            </label>

            {estadoSubmit === 'erro' && (
              <p role="alert" className="text-sm text-velvet-600">
                {mensagemErro}
              </p>
            )}

            <button
              type="submit"
              disabled={estadoSubmit === 'loading'}
              className="mt-2 rounded bg-velvet-600 px-4 py-2 font-display tracking-wide text-cream-100 transition hover:bg-velvet-700 disabled:opacity-60"
            >
              {estadoSubmit === 'loading' ? 'Criando…' : 'Criar sessão'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
