import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { ApiRequestError } from '../api/client';
import { buscarSessao, editarSessao, listarSalas, type Sala, type Sessao, type SessaoGestao } from '../api/sessoes';
import { Alert } from '../components/Alert';
import { Button, buttonClass } from '../components/Button';
import { Card } from '../components/Card';
import { PageShell } from '../components/PageShell';
import { SelectField, TextAreaField, TextField } from '../components/TextField';

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
      <PageShell variant="auth">
        <p className="font-mono text-lg text-paper-100/70">Carregando sessão…</p>
      </PageShell>
    );
  }

  if (estadoCarga === 'erro' || !sessao) {
    return (
      <PageShell variant="auth">
        <div className="flex flex-col items-center gap-4 text-center">
          <Alert>Não foi possível carregar esta sessão agora.</Alert>
          <button type="button" onClick={() => setTentativa((atual) => atual + 1)} className={buttonClass('secondary')}>
            TENTAR NOVAMENTE
          </button>
          <Link to="/organizador/sessoes" className="font-mono text-lg text-flame-400 underline">
            Voltar pra minhas sessões
          </Link>
        </div>
      </PageShell>
    );
  }

  if (estadoSubmit === 'sucesso' && sessaoEditada) {
    return (
      <PageShell variant="auth">
        <Card className="w-full max-w-sm text-center">
          <h1 className="mb-4 font-display text-2xl text-flame-500">Sessão atualizada!</h1>
          <p className="mb-6 text-sm">
            {sessaoEditada.titulo} — {sessaoEditada.salaNome}
          </p>
          <Link to="/organizador/sessoes" className="font-mono text-lg text-flame-600 underline">
            Voltar pra minhas sessões
          </Link>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <h1 className="font-display text-3xl text-flame-600 [text-shadow:3px_3px_0_var(--color-flame-400)]">
          EDITAR SESSÃO
        </h1>

        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <TextField
              id="titulo"
              label="TÍTULO"
              type="text"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              required
            />

            <TextAreaField
              id="sinopse"
              label="SINOPSE"
              value={sinopse}
              onChange={(event) => setSinopse(event.target.value)}
            />

            <SelectField id="sala" label="SALA" value={salaId} onChange={(event) => setSalaId(event.target.value)} required>
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
              {estadoSubmit === 'loading' ? 'SALVANDO…' : 'SALVAR ALTERAÇÕES'}
            </Button>
          </form>
        </Card>
      </div>
    </PageShell>
  );
}
