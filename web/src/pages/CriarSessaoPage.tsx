import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { ApiRequestError } from '../api/client';
import type { Filme } from '../api/filmes';
import { criarSessao, listarSalas, type Sala, type Sessao } from '../api/sessoes';
import { Alert } from '../components/Alert';
import { Button, buttonClass } from '../components/Button';
import { Card } from '../components/Card';
import { PageShell } from '../components/PageShell';
import { SelectField, TextField } from '../components/TextField';

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
      <PageShell variant="auth">
        <p className="font-mono text-lg text-paper-100/70">
          Nenhum filme selecionado. Volte pra{' '}
          <Link to="/organizador" className="text-flame-400 underline">
            busca de filmes
          </Link>{' '}
          e escolha um filme pra criar a sessão.
        </p>
      </PageShell>
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
      <PageShell variant="auth">
        <Card className="w-full max-w-sm text-center">
          <h1 className="mb-4 font-display text-2xl text-flame-500">Sessão criada!</h1>
          <p className="mb-6 text-sm">
            {sessaoCriada.titulo} — {sessaoCriada.salaNome} — capacidade {sessaoCriada.capacidade}
          </p>
          <Link to="/organizador" className="font-mono text-lg text-flame-600 underline">
            Voltar à busca
          </Link>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <h1 className="font-display text-3xl text-flame-600 [text-shadow:3px_3px_0_var(--color-flame-400)]">
          Criar sessão — {filme.titulo}
        </h1>

        {estadoSalas === 'loading' && <p className="font-mono text-lg text-ink-950/60">Carregando salas…</p>}
        {estadoSalas === 'vazio' && <p className="font-mono text-lg text-ink-950/60">Nenhuma sala cadastrada.</p>}
        {estadoSalas === 'erro' && (
          <p role="alert" className="font-mono text-lg text-flame-600">
            Não foi possível carregar as salas agora.
          </p>
        )}

        {(estadoSalas === 'erro' || estadoSalas === 'vazio') && (
          <button type="button" onClick={() => setTentativa((atual) => atual + 1)} className={buttonClass('secondary')}>
            TENTAR NOVAMENTE
          </button>
        )}

        {estadoSalas === 'pronto' && (
          <Card>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
              <SelectField
                id="sala"
                label="SALA"
                value={salaId}
                onChange={(event) => setSalaId(event.target.value)}
                required
              >
                <option value="" disabled>
                  Selecione uma sala
                </option>
                {salas.map((sala) => (
                  <option key={sala.id} value={sala.id}>
                    {sala.nome} ({sala.capacidade} assentos)
                  </option>
                ))}
              </SelectField>

              <TextField
                id="dataHora"
                label="DATA E HORA"
                type="datetime-local"
                value={dataHora}
                onChange={(event) => setDataHora(event.target.value)}
                required
              />

              <TextField
                id="preco"
                label="PREÇO"
                type="number"
                min="0"
                step="0.01"
                value={preco}
                onChange={(event) => setPreco(event.target.value)}
                required
              />

              {estadoSubmit === 'erro' && <Alert>{mensagemErro}</Alert>}

              <Button type="submit" disabled={estadoSubmit === 'loading'} className="mt-2 w-full">
                {estadoSubmit === 'loading' ? 'CRIANDO…' : 'CRIAR SESSÃO'}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
