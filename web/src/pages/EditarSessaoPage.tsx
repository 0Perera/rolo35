import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ApiRequestError } from '../api/client';
import { buscarSessao, editarSessao, listarSalas, type Sala, type Sessao, type SessaoGestao } from '../api/sessoes';

type EstadoCarga = 'loading' | 'erro' | 'pronto';
type EstadoSubmit = 'idle' | 'loading' | 'sucesso' | 'erro';

export function EditarSessaoPage() {
  const { id } = useParams<{ id: string }>();
  const sessaoId = Number(id);

  const [sessao, setSessao] = useState<SessaoGestao | null>(null);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>('loading');
  const [salaId, setSalaId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [sinopse, setSinopse] = useState('');
  const [dataHora, setDataHora] = useState('');
  const [preco, setPreco] = useState('');
  const [estadoSubmit, setEstadoSubmit] = useState<EstadoSubmit>('idle');
  const [mensagemErro, setMensagemErro] = useState('');
  const [sessaoEditada, setSessaoEditada] = useState<Sessao | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    setEstadoCarga('loading');
    Promise.all([buscarSessao(sessaoId), listarSalas()])
      .then(([sessaoCarregada, salasCarregadas]) => {
        if (!ativo) {
          return;
        }
        setSessao(sessaoCarregada);
        setSalas(salasCarregadas);
        setSalaId(String(sessaoCarregada.salaId));
        setTitulo(sessaoCarregada.titulo);
        setSinopse(sessaoCarregada.sinopse ?? '');
        setDataHora(sessaoCarregada.dataHora.slice(0, 16));
        setPreco(String(sessaoCarregada.preco));
        setEstadoCarga('pronto');
      })
      .catch(() => {
        if (ativo) {
          setEstadoCarga('erro');
        }
      });
    return () => {
      ativo = false;
    };
  }, [sessaoId, tentativa]);

  function primeiroErroDeValidacao(): string | null {
    if (!salaId) {
      return 'Selecione uma sala.';
    }
    if (!titulo.trim()) {
      return 'Informe um título.';
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

    const erroDeValidacao = primeiroErroDeValidacao();
    if (erroDeValidacao) {
      setMensagemErro(erroDeValidacao);
      setEstadoSubmit('erro');
      return;
    }

    setEstadoSubmit('loading');
    setMensagemErro('');

    try {
      const resultado = await editarSessao(sessaoId, {
        salaId: Number(salaId),
        titulo,
        sinopse: sinopse || null,
        dataHora: dataHora.length === 16 ? `${dataHora}:00` : dataHora,
        preco: Number(preco),
      });
      setSessaoEditada(resultado);
      setEstadoSubmit('sucesso');
    } catch (error) {
      setMensagemErro(
        error instanceof ApiRequestError ? error.message : 'Não foi possível editar a sessão. Tente novamente.',
      );
      setEstadoSubmit('erro');
    }
  }

  if (estadoCarga === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sepia-950 px-4 font-body text-cream-100">
        <p className="text-sm text-cream-300">Carregando sessão…</p>
      </main>
    );
  }

  if (estadoCarga === 'erro' || !sessao) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sepia-950 px-4 font-body text-cream-100">
        <div className="flex flex-col items-center gap-4 text-center">
          <p role="alert" className="text-sm text-velvet-600">
            Não foi possível carregar esta sessão agora.
          </p>
          <button
            type="button"
            onClick={() => setTentativa((atual) => atual + 1)}
            className="rounded border border-gold-500/60 px-4 py-2 font-display tracking-wide text-amber-300 transition hover:bg-sepia-900"
          >
            Tentar novamente
          </button>
          <Link to="/organizador/sessoes" className="text-amber-300 underline">
            Voltar pra minhas sessões
          </Link>
        </div>
      </main>
    );
  }

  if (estadoSubmit === 'sucesso' && sessaoEditada) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-sepia-950 px-4 font-body text-cream-100">
        <div className="w-full max-w-sm rounded border border-gold-500/40 bg-sepia-900 p-8 text-center">
          <h1 className="mb-4 font-display text-2xl tracking-wide text-amber-300">Sessão atualizada!</h1>
          <p className="mb-6 text-sm text-cream-100">
            {sessaoEditada.titulo} — {sessaoEditada.salaNome}
          </p>
          <Link to="/organizador/sessoes" className="text-amber-300 underline">
            Voltar pra minhas sessões
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-sepia-950 px-4 py-10 font-body text-cream-100">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <h1 className="font-display text-3xl tracking-wide text-amber-300">Editar sessão</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-cream-300">Título</span>
            <input
              type="text"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              required
              className="rounded border border-sepia-700 bg-sepia-950 px-3 py-2 text-cream-100 outline-none focus:border-gold-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-cream-300">Sinopse</span>
            <textarea
              value={sinopse}
              onChange={(event) => setSinopse(event.target.value)}
              className="rounded border border-sepia-700 bg-sepia-950 px-3 py-2 text-cream-100 outline-none focus:border-gold-500"
            />
          </label>

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
            {estadoSubmit === 'loading' ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </form>
      </div>
    </main>
  );
}
