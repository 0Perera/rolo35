import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ApiRequestError } from '../api/client';
import { reservarAssentos } from '../api/reservas';
import { buscarMapaAssentos, type AssentoMapa, type MapaAssentos } from '../api/sessoes';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { PageShell } from '../components/PageShell';
import { formatarPreco, rotuloDeDia, rotuloDeHora } from '../lib/sessoes';

type Estado = 'loading' | 'erro' | 'nao-encontrado' | 'pronto';

const MAX_ASSENTOS = 6;

// O auditório do handoff é uma caixa escura, então os assentos usam a escala escura dele em vez da
// paleta clara do resto da página. Cada estado tem matiz própria — não só luminosidade — pra que
// livre, reservado e vendido não se confundam num relance: livre é o roxo neutro do fundo,
// reservado é o azul do ciano (hold temporário, ainda pode abrir) e vendido é o cinza-vinho morto.
// Só cor: o cursor e o hover ficam de fora pra que a legenda possa reusar exatamente as mesmas
// classes do assento sem herdar comportamento de botão.
const COR_POR_STATUS: Record<AssentoMapa['status'], string> = {
  LIVRE: 'border-[#7E7686] bg-[#221D28] text-[#A79E93]',
  RESERVADO: 'border-cyan-400 bg-[#12384F] text-cyan-400',
  VENDIDO: 'border-[#6B5A62] bg-[#6B5A62] text-[#463A41]',
};

const COR_SELECIONADO =
  'border-flame-400 bg-[linear-gradient(100deg,var(--color-flame-600),var(--color-flame-400))] text-ink-950';

const COR_STATUS_DESCONHECIDO = 'border-flame-600 bg-[#221D28] text-flame-600';

// O assento cresce a partir de lg: num monitor largo a grade de 30px vira um brinquedo dentro de
// um auditório vazio, e é nela que a pessoa precisa acertar o clique.
const ASSENTO_BASE =
  'grid h-[26px] w-[30px] place-items-center rounded-t-[5px] rounded-b-[2px] border-2 p-0 font-mono text-[13px] transition-colors lg:h-[34px] lg:w-[40px] lg:text-[15px]';

const LEGENDA: { rotulo: string; cor: string }[] = [
  { rotulo: 'LIVRE', cor: COR_POR_STATUS.LIVRE },
  { rotulo: 'SELECIONADO', cor: COR_SELECIONADO },
  { rotulo: 'RESERVADO', cor: COR_POR_STATUS.RESERVADO },
  { rotulo: 'VENDIDO', cor: COR_POR_STATUS.VENDIDO },
];

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
  const { state } = useLocation() as { state: { assentoIds?: number[] } | null };
  // Seleção que sobreviveu ao login. Vive num ref porque só vale pra primeira carga: os recarregar
  // seguintes (depois de um 409, por exemplo) precisam limpar a seleção, não ressuscitá-la.
  const selecaoRetomada = useRef<number[] | null>(state?.assentoIds ?? null);
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
        const retomados = selecaoRetomada.current;
        if (retomados) {
          selecaoRetomada.current = null;
          // O mapa que acabou de chegar é a autoridade: assento que outra pessoa levou durante o
          // login não volta selecionado só porque estava na escolha anterior.
          setSelecionados(
            new Set(
              resultado.assentos
                .filter((assento) => assento.status === 'LIVRE' && retomados.includes(assento.id))
                .slice(0, MAX_ASSENTOS)
                .map((assento) => assento.id),
            ),
          );
        }
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
      const reserva = await reservarAssentos({ sessaoId, assentoIds: Array.from(selecionados) });
      navigate(`/pagamento/${reserva.id}`);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        setMensagemErro('Um ou mais assentos selecionados não estão mais disponíveis. O mapa foi atualizado.');
        setSelecionados(new Set());
        await carregarMapa();
      } else if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
        // Sem sessão iniciada não há o que avisar: a saída é o login, e a escolha vai junto pra
        // que voltar signifique continuar de onde parou, não recomeçar.
        navigate('/login', {
          state: {
            retomarEm: `/sessoes/${sessaoId}/assentos`,
            assentoIds: Array.from(selecionados),
          },
        });
      } else {
        setMensagemErro('Não foi possível concluir a reserva agora. Tente novamente.');
      }
    } finally {
      setReservando(false);
    }
  }

  const assentosSelecionados = mapa
    ? mapa.assentos.filter((assento) => selecionados.has(assento.id))
    : [];

  return (
    <PageShell>
      <div className="mx-auto max-w-[1280px] px-5 pt-9 pb-20 sm:px-8 xl:max-w-[1440px]">
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
          <div className="mt-[18px] flex flex-wrap items-start gap-[clamp(22px,3cqw,40px)]">
            {/* Auditório: caixa escura que isola o mapa do fundo claro da página, como no handoff. */}
            <section className="flex-[1_1_620px] overflow-x-auto border-[3px] border-ink-950 bg-ink-950 px-[30px] pt-[34px] pb-7 shadow-[9px_9px_0_rgba(23,18,25,0.85)]">
              {/* Tela, rótulo e grade num bloco só: a curva é 70% da *grade*, não do painel, senão
                  as duas larguras divergem e a tela aparece torta em cima dos assentos. w-max +
                  mx-auto em vez de items-center porque, com a grade mais larga que o painel, o
                  centro joga metade do excesso pra esquerda — lado que o scroll não alcança. */}
              <div className="mx-auto w-max">
                <div
                  aria-hidden="true"
                  className="mx-auto mb-2 h-[34px] w-[70%] border-b-[3px] border-cyan-400"
                  style={{
                    borderRadius: '50% 50% 6px 6px / 100% 100% 6px 6px',
                    backgroundImage: 'linear-gradient(180deg, var(--color-cyan-400), rgba(126,217,242,0.05))',
                  }}
                />
                <p className="mb-[30px] text-center font-mono text-xl tracking-[6px] text-cyan-400">TELA</p>

                <div className="flex flex-col gap-[9px] lg:gap-3" data-testid="grade-assentos">
                  {agruparPorFileira(mapa.assentos).map(({ fileira, assentos }) => (
                    <div key={fileira} className="flex items-center gap-3">
                      <div aria-hidden="true" className="w-[22px] font-display text-sm text-[#7E7686] lg:w-7 lg:text-base">
                        {fileira}
                      </div>
                      <div className="flex gap-[7px] lg:gap-2.5">
                        {assentos.map((assento) => {
                          const selecionado = selecionados.has(assento.id);
                          const livre = assento.status === 'LIVRE';
                          const cor = selecionado
                            ? COR_SELECIONADO
                            : (COR_POR_STATUS[assento.status] ?? COR_STATUS_DESCONHECIDO);
                          // Mesma frase no title e no aria-label: a cor sozinha não diz o estado, e
                          // o leitor de tela precisa da mesma informação que o tooltip do mouse dá.
                          const descricao = `Assento ${assento.fileira}${assento.numero} — ${assento.status.toLowerCase()}`;
                          return (
                            <button
                              key={assento.id}
                              type="button"
                              title={descricao}
                              aria-label={descricao}
                              aria-pressed={selecionado}
                              data-status={assento.status}
                              disabled={!livre}
                              onClick={() => alternarSelecao(assento)}
                              className={`${ASSENTO_BASE} ${cor} ${livre ? 'cursor-pointer hover:border-flame-400' : 'cursor-not-allowed'}`}
                            >
                              {assento.numero}
                            </button>
                          );
                        })}
                      </div>
                      {/* Letra repetida à direita só a partir de sm: numa fileira larga a referência
                          da esquerda fica longe de quem olha a ponta oposta, mas no mobile ela só
                          soma 34px de largura numa grade que já rola. */}
                      <div
                        aria-hidden="true"
                        className="hidden w-[22px] font-display text-sm text-[#7E7686] sm:block lg:w-7 lg:text-base"
                      >
                        {fileira}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 flex flex-wrap justify-center gap-x-[26px] gap-y-3 font-mono text-lg tracking-wide text-[#CFC5B8]">
                {LEGENDA.map(({ rotulo, cor }) => (
                  <span key={rotulo} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`h-[18px] w-5 rounded-t-[4px] rounded-b-[2px] border-2 lg:h-[22px] lg:w-6 ${cor}`}
                    />
                    {rotulo}
                  </span>
                ))}
              </div>
            </section>

            {/* Resumo do pedido: acompanha a seleção sem exigir rolagem de volta pro topo. */}
            <aside className="flex-[1_1_290px] border-[3px] border-ink-950 bg-paper-50 p-6 shadow-[9px_9px_0_var(--color-ink-950)] xl:p-8">
              <p className="font-mono text-lg tracking-[2px] text-[#6D655B]">SEU PEDIDO</p>
              <h1 className="mt-2 font-display text-[22px] leading-[1.1]">{mapa.titulo}</h1>

              <div className="my-4 h-[3px] bg-gradient-to-r from-flame-600 to-flame-400" />

              <div className="grid grid-cols-2 gap-3.5 text-[13px]">
                <div>
                  <div className="font-mono text-[17px] tracking-wide text-[#6D655B]">SESSÃO</div>
                  <div className="mt-0.5 font-bold">
                    {rotuloDeDia(mapa.dataHora)} · {rotuloDeHora(mapa.dataHora)}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[17px] tracking-wide text-[#6D655B]">SALA</div>
                  <div className="mt-0.5 font-bold">{mapa.salaNome.toUpperCase()}</div>
                </div>
              </div>

              <p className="mt-5 font-mono text-[17px] tracking-wide text-[#6D655B]">
                ASSENTOS <span className="text-[#9C9488]">(máx. {MAX_ASSENTOS} · {formatarPreco(mapa.preco)} cada)</span>
              </p>
              <div className="mt-2 flex min-h-[44px] flex-wrap gap-2">
                {assentosSelecionados.map((assento) => (
                  <span
                    key={assento.id}
                    className="border-2 border-ink-950 bg-gradient-to-r from-flame-400 to-[#F7A81B] px-2.5 py-[5px] font-display text-[13px]"
                  >
                    {assento.fileira}
                    {assento.numero}
                  </span>
                ))}
                {assentosSelecionados.length === 0 && (
                  <span className="font-mono text-lg text-[#B5A990]">nenhum assento escolhido</span>
                )}
              </div>

              {avisoLimite && (
                <p role="alert" className="mt-1.5 font-mono text-[15px] text-flame-600">
                  Máximo de {MAX_ASSENTOS} assentos por reserva.
                </p>
              )}

              <div className="mt-5 flex items-baseline justify-between border-t-2 border-dashed border-[#C7B694] pt-4">
                <span className="font-mono text-xl tracking-wide text-[#6D655B]">TOTAL</span>
                <span className="font-display text-[30px] text-flame-600">
                  {formatarPreco(mapa.preco * selecionados.size)}
                </span>
              </div>

              {mensagemErro && (
                <div className="mt-4">
                  <Alert>{mensagemErro}</Alert>
                </div>
              )}

              <Button
                type="button"
                className="mt-[18px] w-full py-[15px] text-base"
                disabled={selecionados.size === 0 || reservando}
                onClick={handleReservar}
              >
                {reservando ? 'RESERVANDO…' : 'IR PARA O PAGAMENTO'}
              </Button>
              <p className="mt-3 text-center font-mono text-base tracking-wide text-[#6D655B]">
                SEUS ASSENTOS FICAM RESERVADOS POR 10 MIN
              </p>
            </aside>
          </div>
        )}
      </div>
    </PageShell>
  );
}
