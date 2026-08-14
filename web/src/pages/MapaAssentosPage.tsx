import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ApiRequestError } from '../api/client';
import { reservarAssentos } from '../api/reservas';
import { buscarMapaAssentos, type AssentoMapa, type MapaAssentos } from '../api/sessoes';
import { buttonClass } from '../components/Button';
import { GradeDeAssentos } from '../components/GradeDeAssentos';
import { PageShell } from '../components/PageShell';
import { ResumoDoPedido } from '../components/ResumoDoPedido';
import { useSessao } from '../lib/sessao';

type Estado = 'loading' | 'erro' | 'nao-encontrado' | 'pronto' | 'encerrada';

const MAX_ASSENTOS = 6;

// Organizador e portaria têm login válido; o que falta é papel. Mandar essa pessoa pro login pediria
// de novo a credencial que ela acabou de usar — e a compra continuaria barrada do outro lado.
const AVISO_PAPEL_SEM_COMPRA =
  'Para comprar ingressos, entre com uma conta de cliente.';

export function MapaAssentosPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, papel } = useSessao();
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
          // login não volta selecionado só porque estava na escolha anterior. MEU_HOLD entra junto
          // de LIVRE — assento que o próprio cliente já segurava continua disponível pra ele.
          setSelecionados(
            new Set(
              resultado.assentos
                .filter(
                  (assento) =>
                    (assento.status === 'LIVRE' || assento.status === 'MEU_HOLD') &&
                    retomados.includes(assento.id),
                )
                .slice(0, MAX_ASSENTOS)
                .map((assento) => assento.id),
            ),
          );
          return;
        }
        // Quem volta do checkout pra trocar de assento reencontra a própria escolha já marcada,
        // em vez de um mapa vazio com os lugares dele bloqueados. Trocar é desmarcar um e clicar
        // noutro; reservar de novo cancela o hold anterior no servidor.
        const meusAssentos = resultado.assentos
          .filter((assento) => assento.status === 'MEU_HOLD')
          .slice(0, MAX_ASSENTOS)
          .map((assento) => assento.id);
        if (meusAssentos.length > 0) {
          setSelecionados(new Set(meusAssentos));
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
    // MEU_HOLD entra junto de LIVRE: o hold é do próprio cliente, então ele pode largar o assento
    // ou mantê-lo. Guarda espelhada em GradeDeAssentos, que é quem desabilita o botão — as duas
    // precisam concordar, senão um assento clicável não faria nada.
    if (assento.status !== 'LIVRE' && assento.status !== 'MEU_HOLD') {
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
    // Papel errado é 403 garantido: avisar aqui poupa a ida à API e mantém a seleção na tela, que é
    // o que a pessoa precisa se resolver trocar de conta.
    if (token && papel !== 'CLIENTE') {
      setMensagemErro(AVISO_PAPEL_SEM_COMPRA);
      return;
    }
    setReservando(true);
    setMensagemErro('');
    try {
      const reserva = await reservarAssentos({ sessaoId, assentoIds: Array.from(selecionados) });
      navigate(`/pagamento/${reserva.id}`);
    } catch (error) {
      if (error instanceof ApiRequestError && error.codigo === 'SESSAO_JA_COMECOU') {
        // Estado terminal, como em PagamentoPage: recarregar o mapa não muda nada (a sessão não
        // volta) e manter a grade na tela deixaria o botão de reservar ativo pra uma chamada que
        // nunca pode dar certo. Trocar de estado tira a grade e o botão junto, e a mensagem passa
        // a vir acompanhada do caminho de saída que ela manda tomar.
        setEstado('encerrada');
      } else if (error instanceof ApiRequestError && error.status === 409) {
        setMensagemErro('Um ou mais assentos selecionados não estão mais disponíveis. O mapa foi atualizado.');
        setSelecionados(new Set());
        await carregarMapa();
      } else if (error instanceof ApiRequestError && error.status === 403) {
        // Rede de segurança do atalho acima: o papel que o front tinha em mãos não era o que a API
        // viu no token. Continua sendo aviso, não desvio — o login não resolveria nada.
        setMensagemErro(AVISO_PAPEL_SEM_COMPRA);
      } else if (error instanceof ApiRequestError && error.status === 401) {
        // Sem sessão iniciada (ou com token já vencido) não há o que avisar: a saída é o login, e a
        // escolha vai junto pra que voltar signifique continuar de onde parou, não recomeçar.
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
        {/* Volta pro filme, que é de onde se escolhe outra sessão. A vitrine é o destino só
            enquanto o mapa não carregou e não se sabe de qual filme ele é. */}
        <Link
          to={mapa ? `/filmes/${mapa.tmdbId}` : '/'}
          className="font-mono text-lg tracking-wide text-ink-950/60 hover:text-flame-600"
        >
          ◀ {mapa ? 'VOLTAR PRAS SESSÕES' : 'VOLTAR PRA PRATELEIRA'}
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

        {estado === 'encerrada' && (
          <div className="mt-6 border-[3px] border-ink-950 bg-paper-50 p-6 shadow-[9px_9px_0_var(--color-ink-950)]">
            <p role="alert" className="font-mono text-lg text-flame-600">
              Essa sessão já começou e não aceita mais reservas.
            </p>
            <Link to={mapa ? `/filmes/${mapa.tmdbId}` : '/'} className={buttonClass('secondary', 'mt-4 inline-block')}>
              ESCOLHER OUTRA SESSÃO
            </Link>
          </div>
        )}

        {estado === 'pronto' && mapa && (
          <div className="mt-[18px] flex flex-wrap items-start gap-[clamp(22px,3cqw,40px)]">
            <GradeDeAssentos
              assentos={mapa.assentos}
              selecionados={selecionados}
              onAlternar={alternarSelecao}
            />
            <ResumoDoPedido
              mapa={mapa}
              assentosSelecionados={assentosSelecionados}
              maximoDeAssentos={MAX_ASSENTOS}
              avisoLimite={avisoLimite}
              mensagemErro={mensagemErro}
              reservando={reservando}
              onReservar={handleReservar}
            />
          </div>
        )}
      </div>
    </PageShell>
  );
}
