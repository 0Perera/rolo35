import { useEffect, useState, type FormEvent } from 'react';
import type { Filme } from '../api/filmes';
import { ApiRequestError } from '../api/client';
import {
  criarSessao,
  editarSessao,
  listarOcupacaoDaSala,
  type OcupacaoSala,
  type Sala,
  type SessaoGestao,
} from '../api/sessoes';
import { dataValida, deDataHoraIso, horaValida, paraDataHoraIso } from '../lib/dataHora';
import { rotuloDeDia, rotuloDeHora } from '../lib/sessoes';
import { Alert } from './Alert';
import { CampoDeData } from './CampoDeData';
import { CampoDeHora } from './CampoDeHora';
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
  const [ocupacao, setOcupacao] = useState<OcupacaoSala[] | null>(null);

  // A ocupação segue a sala escolhida. A janela da própria sessão em edição sai da lista: ela não é
  // obstáculo pra si mesma, e o back já a exclui na checagem de conflito.
  useEffect(() => {
    if (!salaId) {
      setOcupacao(null);
      return;
    }
    let ativo = true;
    listarOcupacaoDaSala(Number(salaId))
      .then((janelas) => {
        if (ativo) {
          setOcupacao(janelas.filter((janela) => janela.sessaoId !== emEdicao?.id));
        }
      })
      // Silencioso de propósito: isto é um aviso preventivo, não a validação. Quem decide se o
      // horário serve continua sendo o POST, e um alerta de rede aqui competiria com o erro real.
      .catch(() => {
        if (ativo) {
          setOcupacao(null);
        }
      });
    return () => {
      ativo = false;
    };
  }, [salaId, emEdicao?.id]);

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

        {ocupacao !== null && (
          <div className="border-[3px] border-ink-950/20 bg-paper-100 p-2.5">
            <span className="block font-mono text-lg tracking-wide text-ink-950/60">SALA JÁ OCUPADA</span>
            {ocupacao.length === 0 ? (
              <p className="mt-1.5 font-mono text-sm tracking-wide text-ink-950/50">
                NENHUM HORÁRIO OCUPADO NESTA SALA.
              </p>
            ) : (
              <>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {ocupacao.map((janela) => (
                    <li key={janela.sessaoId} className="font-mono text-sm tracking-wide">
                      {rotuloDeDia(janela.bloqueadoDe)} {rotuloDeHora(janela.bloqueadoDe)} →{' '}
                      {rotuloDeDia(janela.bloqueadoAte)} {rotuloDeHora(janela.bloqueadoAte)}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 font-mono text-sm tracking-wide text-ink-950/50">
                  INTERVALO BLOQUEADO EM VOLTA DE CADA SESSÃO, PRA DAR TEMPO DE VIRAR A SALA.
                </p>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3.5">
          <CampoDeData id="data" label="DATA" valor={data} onChange={setData} />
          <CampoDeHora id="hora" label="HORA" valor={hora} onChange={setHora} />
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
