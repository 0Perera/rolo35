import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiRequestError } from '../api/client';
import { reservarAssentos } from '../api/reservas';
import { buscarMapaAssentos, type AssentoMapa, type MapaAssentos } from '../api/sessoes';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { PageShell } from '../components/PageShell';

type Estado = 'loading' | 'erro' | 'nao-encontrado' | 'pronto';

const MAX_ASSENTOS = 6;

const ESTILO_POR_STATUS: Record<AssentoMapa['status'], string> = {
  LIVRE: 'border-[3px] border-cyan-400 bg-paper-50 text-ink-950 cursor-pointer',
  RESERVADO: 'border-[3px] border-ink-950 bg-ink-950/40 text-ink-950/50 cursor-not-allowed',
  VENDIDO: 'border-[3px] border-ink-950 bg-ink-950 text-paper-100/50 cursor-not-allowed',
};

const ESTILO_SELECIONADO =
  'border-[3px] border-flame-600 bg-flame-600 text-paper-50 cursor-pointer';

const ESTILO_STATUS_DESCONHECIDO = 'border-[3px] border-flame-600 text-flame-600';

function agruparPorFileira(assentos: AssentoMapa[]): { fileira: string; assentos: AssentoMapa[] }[] {
  const porFileira = new Map<string, AssentoMapa[]>();

  for (const assento of assentos) {
    const lista = porFileira.get(assento.fileira);
    if (lista) {
      lista.push(assento);
    } else {
      porFileira.set(assento.fileira, [assento]);
    }
  }

  return Array.from(porFileira.entries()).map(([fileira, assentosDaFileira]) => ({
    fileira,
    assentos: assentosDaFileira,
  }));
}

export function MapaAssentosPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [mapa, setMapa] = useState<MapaAssentos | null>(null);
  const [estado, setEstado] = useState<Estado>('loading');
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [avisoLimite, setAvisoLimite] = useState(false);
  const [reservando, setReservando] = useState(false);
  const [mensagemErro, setMensagemErro] = useState('');

  const sessaoId = Number(id);

  function carregarMapa(aindaAtivo: () => boolean = () => true) {
    if (!id || Number.isNaN(sessaoId)) {
      setEstado('nao-encontrado');
      return Promise.resolve();
    }
    setEstado('loading');
    return buscarMapaAssentos(sessaoId)
      .then((resultado) => {
        if (!aindaAtivo()) {
          return;
        }
        setMapa(resultado);
        setEstado('pronto');
      })
      .catch((error: unknown) => {
        if (!aindaAtivo()) {
          return;
        }
        setEstado(error instanceof ApiRequestError && error.status === 404 ? 'nao-encontrado' : 'erro');
      });
  }

  useEffect(() => {
    let ativo = true;
    carregarMapa(() => ativo);
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function alternarSelecao(assento: AssentoMapa) {
    if (assento.status !== 'LIVRE') {
      return;
    }
    setSelecionados((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(assento.id)) {
        proximo.delete(assento.id);
        setAvisoLimite(false);
        return proximo;
      }
      if (proximo.size >= MAX_ASSENTOS) {
        setAvisoLimite(true);
        return atual;
      }
      setAvisoLimite(false);
      proximo.add(assento.id);
      return proximo;
    });
  }

  async function handleReservar() {
    if (selecionados.size === 0 || Number.isNaN(sessaoId)) {
      return;
    }
    setReservando(true);
    setMensagemErro('');
    try {
      await reservarAssentos({ sessaoId, assentoIds: Array.from(selecionados) });
      navigate('/em-construcao', {
        state: {
          titulo: 'Reserva confirmada',
          mensagem: 'Seus assentos estão reservados por 10 minutos. O pagamento ainda está sendo montado.',
        },
      });
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        setMensagemErro('Um ou mais assentos selecionados não estão mais disponíveis. O mapa foi atualizado.');
        setSelecionados(new Set());
        await carregarMapa();
      } else if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
        setMensagemErro('Faça login como cliente pra reservar assentos.');
      } else {
        setMensagemErro('Não foi possível concluir a reserva agora. Tente novamente.');
      }
    } finally {
      setReservando(false);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <Link to="/" className="font-mono text-lg tracking-wide text-ink-950/60 hover:text-flame-600">
          ◀ VOLTAR PRA PRATELEIRA
        </Link>

        {estado === 'loading' && <p className="mt-6 font-mono text-lg text-ink-950/60">Carregando…</p>}
        {estado === 'erro' && (
          <p role="alert" className="mt-6 font-mono text-lg text-flame-600">
            Não foi possível carregar o mapa de assentos agora.
          </p>
        )}
        {estado === 'nao-encontrado' && (
          <p role="alert" className="mt-6 font-mono text-lg text-flame-600">
            Sessão não encontrada.
          </p>
        )}

        {estado === 'pronto' && mapa && (
          <div className="mt-6">
            <h1 className="font-display text-[clamp(24px,3.6cqw,40px)] leading-none text-flame-600 [text-shadow:3px_3px_0_var(--color-flame-400)]">
              {mapa.titulo}
            </h1>
            <p className="mt-3 font-mono text-lg tracking-wide text-ink-950/70">
              {mapa.salaNome} ·{' '}
              {new Date(mapa.dataHora).toLocaleString('pt-BR', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              · R$ {mapa.preco.toFixed(2)}
            </p>

            <div className="my-7 h-[3px] bg-ink-950" />

            <div className="flex flex-wrap gap-4 font-mono text-sm tracking-wide text-ink-950/70">
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 border-[3px] border-cyan-400 bg-paper-50" /> livre
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 border-[3px] border-flame-600 bg-flame-600" /> selecionado
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 border-[3px] border-ink-950 bg-ink-950/40" /> reservado
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 border-[3px] border-ink-950 bg-ink-950" /> vendido
              </span>
            </div>

            <div className="mt-6 flex flex-col gap-3" data-testid="grade-assentos">
              {agruparPorFileira(mapa.assentos).map(({ fileira, assentos }) => (
                <div key={fileira} className="flex flex-wrap items-center gap-3">
                  <div className="w-6 font-display text-lg">{fileira}</div>
                  <div className="flex flex-wrap gap-2">
                    {assentos.map((assento) => {
                      const selecionado = selecionados.has(assento.id);
                      const estiloBase = ESTILO_POR_STATUS[assento.status] ?? ESTILO_STATUS_DESCONHECIDO;
                      return (
                        <button
                          key={assento.id}
                          type="button"
                          aria-label={`Assento ${assento.fileira}${assento.numero} — ${assento.status.toLowerCase()}`}
                          aria-pressed={selecionado}
                          data-status={assento.status}
                          disabled={assento.status !== 'LIVRE'}
                          onClick={() => alternarSelecao(assento)}
                          className={`flex h-9 w-9 items-center justify-center font-mono text-sm ${selecionado ? ESTILO_SELECIONADO : estiloBase}`}
                        >
                          {assento.numero}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {avisoLimite && (
              <p role="alert" className="mt-4 font-mono text-lg text-flame-600">
                Máximo de 6 assentos por reserva.
              </p>
            )}
            {mensagemErro && (
              <div className="mt-4">
                <Alert>{mensagemErro}</Alert>
              </div>
            )}

            <Button
              type="button"
              className="mt-6"
              disabled={selecionados.size === 0 || reservando}
              onClick={handleReservar}
            >
              {reservando ? 'RESERVANDO…' : `RESERVAR (${selecionados.size})`}
            </Button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
