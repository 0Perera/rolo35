import { useEffect, useState, type FormEvent } from 'react';
import type { Filme } from '../api/filmes';
import { ApiRequestError } from '../api/client';
import { criarSessao, editarSessao, type Sala, type SessaoGestao } from '../api/sessoes';
import {
  dataValida,
  deDataHoraIso,
  horaValida,
  mascararData,
  mascararHora,
  paraDataHoraIso,
} from '../lib/dataHora';
import { Alert } from './Alert';
import { Button } from './Button';
import { SeletorDeFilme } from './SeletorDeFilme';
import { SeletorDeOpcao } from './SeletorDeOpcao';
import { TextField } from './TextField';

type EstadoSubmit = 'idle' | 'loading' | 'erro';

interface FormSessaoProps {
  salas: Sala[];
  /** Sessão carregada no formulário pra edição; `null` monta o formulário de criação. */
  emEdicao: SessaoGestao | null;
  onSalvou: () => void;
  onCancelarEdicao: () => void;
}


export function FormSessao({ salas, emEdicao, onSalvou, onCancelarEdicao }: FormSessaoProps) {
  const [filme, setFilme] = useState<Filme | null>(null);
  const [salaId, setSalaId] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [preco, setPreco] = useState('');
  const [estado, setEstado] = useState<EstadoSubmit>('idle');
  const [mensagemErro, setMensagemErro] = useState('');

  useEffect(() => {
    if (!emEdicao) {
      return;
    }
    const partes = deDataHoraIso(emEdicao.dataHora);
    setFilme(null);
    setSalaId(String(emEdicao.salaId));
    setData(partes.data);
    setHora(partes.hora);
    setPreco(String(emEdicao.preco));
    setEstado('idle');
    setMensagemErro('');
  }, [emEdicao]);

  function limpar() {
    setFilme(null);
    setSalaId('');
    setData('');
    setHora('');
    setPreco('');
    setEstado('idle');
    setMensagemErro('');
  }

  // O form usa noValidate (mesmo padrão das outras telas), então required não vale nada aqui.
  function primeiroErroDeValidacao(): string | null {
    if (!emEdicao && !filme) {
      return 'Escolha um filme do catálogo.';
    }
    if (!salaId) {
      return 'Selecione uma sala.';
    }
    if (!dataValida(data)) {
      return 'Informe a data no formato dd/mm/aaaa.';
    }
    if (!horaValida(hora)) {
      return 'Informe a hora no formato hh:mm.';
    }
    if (!preco || Number(preco) <= 0) {
      return 'Informe um preço maior que zero.';
    }
    return null;
  }

  async function handleSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const erroDeValidacao = primeiroErroDeValidacao();
    if (erroDeValidacao) {
      setMensagemErro(erroDeValidacao);
      setEstado('erro');
      return;
    }

    setEstado('loading');
    setMensagemErro('');
    const dataHora = paraDataHoraIso(data, hora);

    try {
      if (emEdicao) {
        await editarSessao(emEdicao.id, {
          salaId: Number(salaId),
          titulo: emEdicao.titulo,
          sinopse: emEdicao.sinopse,
          dataHora,
          preco: Number(preco),
        });
      } else {
        await criarSessao({
          salaId: Number(salaId),
          tmdbId: filme!.tmdbId,
          titulo: filme!.titulo,
          posterUrl: filme!.posterUrl,
          sinopse: filme!.sinopse,
          dataEstreia: filme!.dataEstreia,
          dataHora,
          preco: Number(preco),
        });
      }
      limpar();
      onSalvou();
    } catch (erro) {
      setMensagemErro(
        erro instanceof ApiRequestError
          ? erro.message
          : `Não foi possível ${emEdicao ? 'salvar' : 'criar'} a sessão. Tente novamente.`,
      );
      setEstado('erro');
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="w-full max-w-[400px] flex-[1_1_320px] border-[3px] border-ink-950 bg-paper-50 p-6 shadow-[9px_9px_0_var(--color-ink-950)]"
    >
      <div className="font-display text-xl">{emEdicao ? 'EDITAR SESSÃO' : 'NOVA SESSÃO'}</div>
      <div className="my-3.5 h-1 bg-gradient-to-r from-flame-600 to-flame-400" />

      <div className="flex flex-col gap-4">
        {emEdicao ? (
          <div>
            <span className="block font-mono text-lg tracking-wide text-ink-950/60">FILME</span>
            <p className="mt-1.5 border-[3px] border-ink-950/20 bg-paper-100 p-2.5 text-sm font-bold">
              {emEdicao.titulo}
            </p>
            <p className="mt-1.5 font-mono text-sm tracking-wide text-ink-950/50">
              O FILME DE UMA SESSÃO PUBLICADA NÃO TROCA.
            </p>
          </div>
        ) : (
          <SeletorDeFilme filme={filme} onEscolher={setFilme} />
        )}

        <SeletorDeOpcao
          label="SALA"
          placeholder="Selecione uma sala"
          valor={salaId}
          onEscolher={setSalaId}
          opcoes={salas.map((sala) => ({
            valor: String(sala.id),
            rotulo: `${sala.nome} (${sala.capacidade} assentos)`,
          }))}
        />

        <div className="grid grid-cols-2 gap-3.5">
          <TextField
            id="data"
            label="DATA"
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            value={data}
            onChange={(evento) => setData(mascararData(evento.target.value))}
            required
          />
          <TextField
            id="hora"
            label="HORA"
            inputMode="numeric"
            placeholder="hh:mm"
            value={hora}
            onChange={(evento) => setHora(mascararHora(evento.target.value))}
            required
          />
        </div>

        <TextField
          id="preco"
          label="PREÇO INTEIRA (R$)"
          type="number"
          min="0"
          step="0.01"
          value={preco}
          onChange={(evento) => setPreco(evento.target.value)}
          required
        />

        {estado === 'erro' && <Alert>{mensagemErro}</Alert>}

        <Button type="submit" disabled={estado === 'loading'} className="w-full">
          {estado === 'loading' ? 'SALVANDO…' : emEdicao ? 'SALVAR ALTERAÇÕES' : 'PUBLICAR SESSÃO'}
        </Button>

        {emEdicao && (
          <button
            type="button"
            onClick={() => {
              limpar();
              onCancelarEdicao();
            }}
            className="font-mono text-base tracking-wide text-ink-950/60 underline"
          >
            cancelar edição
          </button>
        )}
      </div>
    </form>
  );
}
