import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { ApiRequestError } from '../api/client';
import { confirmarPagamento, type Pagamento, type ResultadoSimulado } from '../api/pagamentos';
import { buscarReserva, type ReservaCheckout } from '../api/reservas';
import { buttonClass } from '../components/Button';
import { CanhotoEmitido } from '../components/CanhotoEmitido';
import { CartaoDeAviso } from '../components/CartaoDeAviso';
import { FormularioDeCartao } from '../components/FormularioDeCartao';
import { PageShell } from '../components/PageShell';
import { ResumoDaReserva } from '../components/ResumoDaReserva';
import { SectionTitle } from '../components/SectionTitle';
import { problemaNoCartao, type DadosDoCartao } from '../lib/cartao';
import { rotuloDeDia, rotuloDeHora } from '../lib/sessoes';

type Estado =
  | 'loading'
  | 'nao-autorizado'
  | 'erro'
  | 'pronto'
  | 'expirada'
  // Sessão começou antes do pagamento sair: terminal como 'expirada', mas por outro motivo — o
  // hold pode até estar de pé, o que acabou foi a sessão.
  | 'sessao-comecou'
  | 'recusada'
  | 'aprovada'
  // Reserva já paga: os canhotos não são recuperáveis por GET (os códigos assinados só existem na
  // resposta do POST), mas eles já estão na carteira — mandar pra lá é o oposto de perder algo.
  | 'ja-confirmada';

const CARTAO_VAZIO: DadosDoCartao = { nome: '', numero: '', validade: '', cvv: '' };

function rotuloDoContador(restanteMs: number | null): string {
  if (restanteMs === null) {
    return '--:--';
  }
  const segundos = Math.max(0, Math.floor(restanteMs / 1000));
  return `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;
}

export function PagamentoPage() {
  const { reservaId } = useParams<{ reservaId: string }>();
  const id = Number(reservaId);

  const [reserva, setReserva] = useState<ReservaCheckout | null>(null);
  const [estado, setEstado] = useState<Estado>('loading');
  const [pagamento, setPagamento] = useState<Pagamento | null>(null);
  // Dado de cartão vive só aqui: nada de storage, nada de log, nada no corpo da requisição.
  const [cartao, setCartao] = useState(CARTAO_VAZIO);
  const [resultado, setResultado] = useState<ResultadoSimulado>('APROVADO');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [restanteMs, setRestanteMs] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    if (!reservaId || Number.isNaN(id)) {
      setEstado('nao-autorizado');
      return;
    }
    setEstado('loading');
    buscarReserva(id)
      .then((resultadoDaBusca) => {
        if (!ativo) {
          return;
        }
        setReserva(resultadoDaBusca);
        // Quem decide o destino é o status do servidor, não por onde o cliente chegou.
        if (resultadoDaBusca.status === 'CONFIRMADA') {
          setEstado('ja-confirmada');
        } else if (resultadoDaBusca.status === 'RECUSADA') {
          setEstado('recusada');
        } else {
          setEstado('pronto');
        }
      })
      .catch((error: unknown) => {
        if (!ativo) {
          return;
        }
        const negado = error instanceof ApiRequestError && (error.status === 401 || error.status === 403);
        setEstado(negado ? 'nao-autorizado' : 'erro');
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservaId]);

  const expiresAt = reserva?.expiresAt ?? null;

  // O contador roda contra o relógio do navegador, que pode divergir do da API. Ele serve pra dar
  // noção de urgência e pra parar de oferecer uma ação que o servidor vai recusar — quem decide de
  // fato se a reserva venceu continua sendo o 409 do back, tratado em handleConfirmar.
  useEffect(() => {
    if (estado !== 'pronto' || !expiresAt) {
      return;
    }
    const alvo = new Date(expiresAt).getTime();
    const atualizar = () => {
      const restante = alvo - Date.now();
      setRestanteMs(restante);
      if (restante <= 0) {
        setEstado('expirada');
      }
    };
    atualizar();
    const timer = setInterval(atualizar, 1000);
    return () => clearInterval(timer);
  }, [estado, expiresAt]);

  // Aprovação, recusa e expiração trocam a tela inteira sem trocar de rota, então o scroll-to-top
  // que existe pra mudança de rota não age aqui — e a tela nova abriria na altura em que o botão
  // de confirmar estava.
  useEffect(() => {
    if (estado === 'aprovada' || estado === 'recusada' || estado === 'expirada' || estado === 'sessao-comecou') {
      window.scrollTo(0, 0);
    }
  }, [estado]);

  const assentos = reserva?.assentos ?? [];
  const total = (reserva?.preco ?? 0) * assentos.length;
  const linkDoMapa = reserva ? `/sessoes/${reserva.sessaoId}/assentos` : '/';

  function alterarCartao(campo: keyof DadosDoCartao, valor: string) {
    setCartao((atual) => ({ ...atual, [campo]: valor }));
    setAviso('');
  }

  async function handleConfirmar() {
    const problema = problemaNoCartao(cartao);
    if (problema) {
      setAviso(problema);
      return;
    }
    setEnviando(true);
    setAviso('');
    try {
      const resposta = await confirmarPagamento({ reservaId: id, resultadoSimulado: resultado });
      setPagamento(resposta);
      setEstado(resposta.status === 'CONFIRMADA' ? 'aprovada' : 'recusada');
    } catch (error) {
      if (error instanceof ApiRequestError && error.codigo === 'RESERVA_EXPIRADA') {
        setEstado('expirada');
      } else if (error instanceof ApiRequestError && error.codigo === 'SESSAO_JA_COMECOU') {
        setEstado('sessao-comecou');
      } else if (error instanceof ApiRequestError && error.codigo === 'RESERVA_EM_DISPUTA') {
        // Contenção momentânea, não perda do hold: a mesma ação tem chance de funcionar agora.
        setAviso('A reserva está em disputa neste instante. Tente novamente.');
      } else if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
        setEstado('nao-autorizado');
      } else {
        setAviso('Não foi possível confirmar o pagamento agora. Tente novamente.');
      }
    } finally {
      setEnviando(false);
    }
  }

  if (estado === 'ja-confirmada') {
    return <Navigate to="/meus-ingressos" replace />;
  }

  if (estado === 'loading' || estado === 'erro' || estado === 'nao-autorizado') {
    return (
      <PageShell>
        <div className="mx-auto max-w-[940px] px-5 pt-9 pb-[90px] sm:px-8 xl:max-w-[1100px]">
          {estado === 'loading' && <p className="font-mono text-lg text-ink-950/60">Carregando…</p>}
          {estado === 'erro' && (
            <p role="alert" className="font-mono text-lg text-flame-600">
              Não foi possível carregar sua reserva agora.
            </p>
          )}
          {estado === 'nao-autorizado' && (
            <p role="alert" className="font-mono text-lg text-flame-600">
              Esta reserva não é sua ou não existe mais.
            </p>
          )}
        </div>
      </PageShell>
    );
  }

  if (estado === 'expirada') {
    return (
      <PageShell>
        <CartaoDeAviso
          kicker="⏱ TEMPO ESGOTADO"
          titulo="A RESERVA EXPIROU"
          acoes={
            <>
              <Link to={linkDoMapa} className={buttonClass('primary')}>
                ESCOLHER ASSENTOS DE NOVO
              </Link>
              <Link to="/" className={buttonClass('secondary')}>
                VER OUTRAS SESSÕES
              </Link>
            </>
          }
        >
          O hold de 10 minutos venceu e os assentos voltaram pra quem quiser. Nada foi cobrado — refaça a
          seleção no mapa da sessão.
        </CartaoDeAviso>
      </PageShell>
    );
  }

  if (estado === 'sessao-comecou') {
    return (
      <PageShell>
        <CartaoDeAviso
          kicker="🎬 SESSÃO EM ANDAMENTO"
          titulo="A SESSÃO JÁ COMEÇOU"
          acoes={
            <Link to="/" className={buttonClass('primary')}>
              VER OUTRAS SESSÕES
            </Link>
          }
        >
          O horário desta sessão passou enquanto o pagamento não era confirmado. Nada foi cobrado — escolha
          outra sessão na programação.
        </CartaoDeAviso>
      </PageShell>
    );
  }

  if (estado === 'recusada') {
    return (
      <PageShell>
        <CartaoDeAviso
          kicker="✕ PAGAMENTO RECUSADO"
          titulo="A RESERVA FOI CANCELADA"
          acoes={
            <>
              <Link to={linkDoMapa} className={buttonClass('primary')}>
                TENTAR DE NOVO
              </Link>
              <Link to="/" className={buttonClass('secondary')}>
                VER OUTRAS SESSÕES
              </Link>
            </>
          }
        >
          Os assentos voltaram a ficar livres para outras pessoas. Nenhum ingresso foi emitido e nada foi
          cobrado.
        </CartaoDeAviso>
      </PageShell>
    );
  }

  if (estado === 'aprovada' && reserva && pagamento) {
    return (
      <PageShell>
        <div className="mx-auto max-w-[900px] px-5 pt-[46px] pb-[90px] sm:px-8 xl:max-w-[1040px]">
          <div className="text-center">
            <p className="font-mono text-[22px] tracking-[4px] text-navy-700">✓ PAGAMENTO APROVADO</p>
            <h1 className="mt-2.5 font-display text-[clamp(28px,4.4cqw,44px)] leading-tight text-flame-600 [text-shadow:3px_3px_0_var(--color-flame-400)]">
              TICKET NA MÃO
            </h1>
            <p className="mt-2.5 font-mono text-[19px] tracking-wide text-[#6D655B]">
              {pagamento.ingressos.length} INGRESSO{pagamento.ingressos.length === 1 ? '' : 'S'} ·{' '}
              {rotuloDeDia(reserva.dataHora ?? '')} · {rotuloDeHora(reserva.dataHora ?? '')}
            </p>
          </div>

          <div className="mt-9 flex flex-col gap-6">
            {pagamento.ingressos.map((ingresso) => {
              const assento = assentos.find((candidato) => candidato.id === ingresso.assentoId);
              return (
                <CanhotoEmitido
                  key={ingresso.id}
                  ingresso={ingresso}
                  reserva={reserva}
                  rotuloAssento={assento ? `${assento.fileira}${assento.numero}` : '—'}
                />
              );
            })}
          </div>

          <div className="mt-[30px] flex flex-wrap justify-center gap-3">
            <Link to="/meus-ingressos" className={buttonClass('primary')}>
              VER MEUS INGRESSOS
            </Link>
            <Link to="/" className={buttonClass('secondary')}>
              VER OUTRA SESSÃO
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-[940px] px-5 pt-9 pb-[90px] sm:px-8 xl:max-w-[1100px]">
        <Link to={linkDoMapa} className="font-mono text-lg tracking-wide text-ink-950/60 hover:text-flame-600">
          ◀ TROCAR ASSENTOS
        </Link>

        <div className="mt-3.5 flex flex-wrap items-end justify-between gap-5">
          <SectionTitle kicker="RESERVA ATIVA" rule={false}>
            PAGAMENTO
          </SectionTitle>
          <div className="border-[3px] border-ink-950 bg-ink-950 px-[18px] py-2.5 shadow-[5px_5px_0_var(--color-flame-400)]">
            <p className="font-mono text-base tracking-[2px] text-cyan-400">RESERVA EXPIRA EM</p>
            <p className="mt-0.5 font-display text-[26px] text-flame-400" aria-live="polite">
              {rotuloDoContador(restanteMs)}
            </p>
          </div>
        </div>

        <div className="mt-[30px] flex flex-wrap items-start gap-[clamp(22px,3cqw,36px)]">
          <FormularioDeCartao
            cartao={cartao}
            onAlterar={alterarCartao}
            resultado={resultado}
            onEscolherResultado={setResultado}
            aviso={aviso}
            enviando={enviando}
            total={total}
            onConfirmar={handleConfirmar}
          />
          <ResumoDaReserva reserva={reserva} total={total} />
        </div>
      </div>
    </PageShell>
  );
}
