import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { ApiRequestError } from '../api/client';
import { confirmarPagamento, type Pagamento, type ResultadoSimulado } from '../api/pagamentos';
import { buscarReserva, type ReservaCheckout } from '../api/reservas';
import { Alert } from '../components/Alert';
import { Button, buttonClass } from '../components/Button';
import { CanhotoIngresso } from '../components/CanhotoIngresso';
import { PageShell } from '../components/PageShell';
import { SectionTitle } from '../components/SectionTitle';
import { TextField } from '../components/TextField';
import {
  formatarCvv,
  formatarNomeNoCartao,
  formatarNumeroCartao,
  formatarValidade,
  problemaNoCartao,
  type DadosDoCartao,
} from '../lib/cartao';
import { urlPublicaDoIngresso } from '../lib/ingressos';
import { formatarPreco, rotuloDeDia, rotuloDeHora } from '../lib/sessoes';

type Estado =
  | 'loading'
  | 'nao-autorizado'
  | 'erro'
  | 'pronto'
  | 'expirada'
  | 'recusada'
  | 'aprovada'
  // Reserva já paga: os canhotos não são recuperáveis por GET (os códigos assinados só existem na
  // resposta do POST), mas eles já estão na carteira — mandar pra lá é o oposto de perder algo.
  | 'ja-confirmada';

const OPCOES_RESULTADO: { valor: ResultadoSimulado; rotulo: string }[] = [
  { valor: 'APROVADO', rotulo: 'APROVAR' },
  { valor: 'RECUSADO', rotulo: 'RECUSAR' },
];

const CARTAO_VAZIO: DadosDoCartao = { nome: '', numero: '', validade: '', cvv: '' };

function rotuloDoContador(restanteMs: number | null): string {
  if (restanteMs === null) {
    return '--:--';
  }
  const segundos = Math.max(0, Math.floor(restanteMs / 1000));
  return `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;
}

/** Cartão de aviso centralizado — mesmo desenho pra recusa e pra expiração, cores diferentes. */
function CartaoDeAviso({
  kicker,
  titulo,
  children,
  acoes,
}: {
  kicker: string;
  titulo: string;
  children: React.ReactNode;
  acoes: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[620px] px-5 pt-[60px] pb-[100px] sm:px-8">
      <div className="border-[3px] border-ink-950 bg-paper-50 p-[clamp(24px,4cqw,36px)] text-center shadow-[10px_10px_0_var(--color-flame-600)]">
        <p className="font-mono text-[22px] tracking-[4px] text-[#A8170F]">{kicker}</p>
        <h1 className="mt-3 font-display text-[clamp(24px,3.6cqw,34px)] leading-tight">{titulo}</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[#4A4249]">{children}</p>
        <div className="mt-[26px] flex flex-wrap justify-center gap-3">{acoes}</div>
      </div>
    </div>
  );
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

  const assentos = reserva?.assentos ?? [];
  const total = (reserva?.preco ?? 0) * assentos.length;
  const linkDoMapa = reserva ? `/sessoes/${reserva.sessaoId}/assentos` : '/';

  // A máscara é aplicada no onChange, não só na validação do envio: o campo recusa o caractere no
  // instante em que ele é digitado, em vez de aceitar qualquer coisa e reclamar no fim.
  function alterarCartao(campo: keyof DadosDoCartao, formatar: (valor: string) => string) {
    return (valor: string) => {
      setCartao((atual) => ({ ...atual, [campo]: formatar(valor) }));
      setAviso('');
    };
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
        <div className="mx-auto max-w-[940px] px-5 pt-9 pb-[90px] sm:px-8">
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
        <div className="mx-auto max-w-[900px] px-5 pt-[46px] pb-[90px] sm:px-8">
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
              const rotuloAssento = assento ? `${assento.fileira}${assento.numero}` : '—';
              return (
                <CanhotoIngresso key={ingresso.id} urlPublica={urlPublicaDoIngresso(ingresso.codigo)}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[19px] tracking-[2px] text-[#6D655B]">
                        ROLO 35 · {(reserva.salaNome ?? '').toUpperCase()}
                      </p>
                      <h2 className="mt-1.5 font-display text-[clamp(20px,2.8cqw,28px)] leading-[1.05]">
                        {reserva.sessaoTitulo}
                      </h2>
                    </div>
                    <span className="shrink-0 border-[3px] border-navy-700 px-3.5 py-1.5 font-display text-xl text-navy-700">
                      {rotuloAssento}
                    </span>
                  </div>

                  <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-[18px] border-t-2 border-dashed border-[#C7B694] pt-[18px]">
                    <div>
                      <p className="font-mono text-[17px] tracking-wide text-[#6D655B]">DATA</p>
                      <p className="mt-1 font-display text-base">{rotuloDeDia(reserva.dataHora ?? '')}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[17px] tracking-wide text-[#6D655B]">HORA</p>
                      <p className="mt-1 font-display text-base">{rotuloDeHora(reserva.dataHora ?? '')}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[17px] tracking-wide text-[#6D655B]">ASSENTO</p>
                      <p className="mt-1 font-display text-base">{rotuloAssento}</p>
                    </div>
                    <div>
                      <p className="font-mono text-[17px] tracking-wide text-[#6D655B]">VALOR</p>
                      <p className="mt-1 font-display text-base text-flame-600">
                        {formatarPreco(reserva.preco ?? 0)}
                      </p>
                    </div>
                  </div>

                  {/* break-all: o código é `uuid.assinatura`, uma palavra só e longa o bastante pra
                      estourar o canhoto no mobile. */}
                  <p className="mt-5 font-mono text-[17px] tracking-wide break-all text-[#6D655B]">
                    CÓDIGO {ingresso.codigo}
                  </p>
                  <p className="mt-1 font-mono text-base tracking-wide text-[#9C9488]">
                    ASSINADO · APRESENTE NA PORTARIA ATÉ 15 MIN ANTES
                  </p>
                </CanhotoIngresso>
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
      <div className="mx-auto max-w-[940px] px-5 pt-9 pb-[90px] sm:px-8">
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
          <section className="flex-[1_1_380px] border-[3px] border-ink-950 bg-paper-50 p-[clamp(20px,3cqw,30px)] shadow-[9px_9px_0_var(--color-ink-950)]">
            <h2 className="font-display text-xl">DADOS DO CARTÃO</h2>
            <div className="mt-3.5 mb-[22px] h-1 bg-gradient-to-r from-flame-600 to-flame-400" />

            {/* autoComplete="off" e nenhum autocomplete de cartão real (cc-number, cc-exp): o
                formulário é teatro da simulação, e convidar o navegador a guardar um cartão de
                verdade aqui seria pedir um dado que o sistema não tem por que ter. */}
            <TextField
              id="pagamento-nome"
              label="NOME NO CARTÃO"
              autoComplete="off"
              value={cartao.nome}
              onChange={(evento) => alterarCartao('nome', formatarNomeNoCartao)(evento.target.value)}
            />
            <div className="mt-4">
              <TextField
                id="pagamento-numero"
                label="NÚMERO DO CARTÃO"
                inputMode="numeric"
                placeholder="0000 0000 0000 0000"
                autoComplete="off"
                value={cartao.numero}
                onChange={(evento) => alterarCartao('numero', formatarNumeroCartao)(evento.target.value)}
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3.5">
              <TextField
                id="pagamento-validade"
                label="VALIDADE"
                inputMode="numeric"
                placeholder="MM/AA"
                autoComplete="off"
                value={cartao.validade}
                onChange={(evento) => alterarCartao('validade', formatarValidade)(evento.target.value)}
              />
              <TextField
                id="pagamento-cvv"
                label="CVV"
                inputMode="numeric"
                placeholder="000"
                autoComplete="off"
                value={cartao.cvv}
                onChange={(evento) => alterarCartao('cvv', formatarCvv)(evento.target.value)}
              />
            </div>

            <div className="mt-6 border-t-2 border-dashed border-[#C7B694] pt-5">
              <p className="font-mono text-lg tracking-[2px] text-[#6D655B]">RESULTADO SIMULADO</p>
              <div className="mt-2.5 flex gap-2">
                {OPCOES_RESULTADO.map((opcao) => {
                  const ativo = resultado === opcao.valor;
                  return (
                    <button
                      key={opcao.valor}
                      type="button"
                      aria-pressed={ativo}
                      onClick={() => setResultado(opcao.valor)}
                      className={`flex-1 cursor-pointer border-[3px] border-ink-950 px-2.5 py-3 font-mono text-lg tracking-wide ${
                        ativo
                          ? 'bg-gradient-to-r from-flame-600 to-flame-400 text-ink-950'
                          : 'bg-paper-100 text-ink-950/60 hover:bg-paper-50'
                      }`}
                    >
                      {opcao.rotulo}
                    </button>
                  );
                })}
              </div>
            </div>

            {aviso && (
              <div className="mt-[18px]">
                <Alert>{aviso}</Alert>
              </div>
            )}

            <Button
              type="button"
              className="mt-[22px] w-full py-4 text-base"
              disabled={enviando}
              onClick={handleConfirmar}
            >
              {enviando ? 'CONFIRMANDO…' : `CONFIRMAR PAGAMENTO · ${formatarPreco(total)}`}
            </Button>
          </section>

          <aside className="flex-[1_1_280px] border-[3px] border-ink-950 bg-paper-50 p-6 shadow-[9px_9px_0_var(--color-ink-950)]">
            <p className="font-mono text-[19px] tracking-[2px] text-[#6D655B]">SUA RESERVA</p>
            <h2 className="mt-2 font-display text-xl leading-[1.1]">{reserva?.sessaoTitulo}</h2>
            <div className="my-4 h-[3px] bg-gradient-to-r from-flame-600 to-flame-400" />

            <div className="grid gap-3.5 text-[13px]">
              <div>
                <p className="font-mono text-[17px] tracking-wide text-[#6D655B]">SESSÃO</p>
                <p className="mt-0.5 font-bold">
                  {rotuloDeDia(reserva?.dataHora ?? '')} · {rotuloDeHora(reserva?.dataHora ?? '')}
                </p>
              </div>
              <div>
                <p className="font-mono text-[17px] tracking-wide text-[#6D655B]">SALA</p>
                <p className="mt-0.5 font-bold">{(reserva?.salaNome ?? '').toUpperCase()}</p>
              </div>
            </div>

            <p className="mt-[18px] font-mono text-[17px] tracking-wide text-[#6D655B]">
              ASSENTOS · 1 INGRESSO CADA
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {assentos.map((assento) => (
                <span
                  key={assento.id}
                  className="border-2 border-ink-950 bg-gradient-to-r from-flame-400 to-[#F7A81B] px-2.5 py-[5px] font-display text-[13px]"
                >
                  {assento.fileira}
                  {assento.numero}
                </span>
              ))}
            </div>

            <div className="mt-5 flex items-baseline justify-between border-t-2 border-dashed border-[#C7B694] pt-4">
              <span className="font-mono text-xl tracking-wide text-[#6D655B]">TOTAL</span>
              <span className="font-display text-[28px] text-flame-600">{formatarPreco(total)}</span>
            </div>
          </aside>
        </div>
      </div>
    </PageShell>
  );
}
