import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listarSalas, listarSessoesPublicadas, type Sala, type SessaoPublicada } from '../api/sessoes';
import { buttonClass } from '../components/Button';
import { CampoDeBusca } from '../components/CampoDeBusca';
import { CardDeFilme } from '../components/CardDeFilme';
import { PageShell } from '../components/PageShell';
import { Paginacao } from '../components/Paginacao';
import { SectionTitle } from '../components/SectionTitle';
import { SeletorDeOpcao } from '../components/SeletorDeOpcao';
import { TvDeTubo } from '../components/TvDeTubo';
import { nomeExibidoDaSala } from '../lib/salas';
import { agruparPorFilme, formatarPreco } from '../lib/sessoes';

type Estado = 'loading' | 'vazio' | 'erro' | 'pronto';

const MAXIMO_DE_CANAIS = 6;
const TROCA_DE_CANAL_MS = 7000;
const TAMANHO_PAGINA = 12;

/** `matchMedia` não existe no jsdom, então a checagem é defensiva. */
function prefereMenosAnimacao(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function ListagemSessoesPage() {
  const [parametros, setParametros] = useSearchParams();
  const busca = parametros.get('q') ?? '';
  const salaId = parametros.get('sala') ?? '';
  const pagina = Number(parametros.get('pagina') ?? '0');

  const [sessoes, setSessoes] = useState<SessaoPublicada[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [salasIndisponiveis, setSalasIndisponiveis] = useState(false);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [estado, setEstado] = useState<Estado>('loading');
  const [tentativa, setTentativa] = useState(0);
  const [heroIdx, setHeroIdx] = useState(0);
  // Liga na primeira resposta, de sucesso ou de falha, e não desliga mais: é o que separa "ainda
  // não sabemos o que há em cartaz" de "já sabemos, e não há nada". Sem essa distinção o aparelho
  // não teria como ficar no ar durante uma recarga que parte do vazio.
  const [jaRespondeu, setJaRespondeu] = useState(false);

  // As salas não dependem da busca nem da página, então são buscadas uma vez só. Uma falha aqui
  // não pode derrubar a vitrine — o catálogo é o conteúdo principal — mas também não pode ser
  // engolida: sem lista, o seletor abria com "TODAS AS SALAS" e nada mais, e o filtro parecia
  // exigir login. Não derrubar não é o mesmo que fingir que deu certo.
  useEffect(() => {
    let ativo = true;
    listarSalas()
      .then((resultado) => {
        if (ativo) {
          setSalas(resultado);
        }
      })
      .catch(() => {
        if (ativo) {
          setSalasIndisponiveis(true);
        }
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    setEstado('loading');
    listarSessoesPublicadas({
      busca,
      salaId: salaId ? Number(salaId) : undefined,
      pagina,
      tamanho: TAMANHO_PAGINA,
    })
      .then((resultado) => {
        if (!ativo) {
          return;
        }
        setSessoes(resultado.conteudo);
        setTotalPaginas(resultado.totalPaginas);
        setEstado(resultado.conteudo.length === 0 ? 'vazio' : 'pronto');
        setJaRespondeu(true);
      })
      .catch(() => {
        if (ativo) {
          setEstado('erro');
          setJaRespondeu(true);
        }
      });
    return () => {
      ativo = false;
    };
  }, [busca, salaId, pagina, tentativa]);

  // "TODAS AS SALAS" é opção de verdade na lista, não só placeholder: sem ela não há como desfazer
  // o filtro depois de escolher uma sala.
  const opcoesDeSala = [
    { valor: '', rotulo: 'TODAS AS SALAS' },
    ...salas.map((sala) => ({ valor: String(sala.id), rotulo: nomeExibidoDaSala(sala.nome) })),
  ];

  // Filtro novo sempre recomeça da primeira página e do primeiro canal: a página que estava aberta
  // e o filme que estava no ar são do resultado anterior, não deste.
  function filtrar(mudancas: Record<string, string>) {
    const proximos = new URLSearchParams(parametros);
    for (const [chave, valor] of Object.entries(mudancas)) {
      if (valor) {
        proximos.set(chave, valor);
      } else {
        proximos.delete(chave);
      }
    }
    proximos.delete('pagina');
    setParametros(proximos);
    setHeroIdx(0);
  }

  function irPara(novaPagina: number) {
    const proximos = new URLSearchParams(parametros);
    proximos.set('pagina', String(novaPagina));
    setParametros(proximos);
    setHeroIdx(0);
  }

  const filmes = useMemo(() => agruparPorFilme(sessoes), [sessoes]);
  // O hero do protótipo tem seis canais; com mais filmes em cartaz a fileira de bolinhas
  // viraria uma régua sem serventia — o resto do catálogo aparece na grade abaixo.
  const canais = filmes.slice(0, MAXIMO_DE_CANAIS);
  const totalDeCanais = canais.length;

  // A TV troca de canal sozinha, como uma vitrine de cinema. Fica parada quando só há um
  // filme em cartaz e quando o sistema pede menos animação.
  useEffect(() => {
    if (totalDeCanais < 2 || prefereMenosAnimacao()) {
      return;
    }
    const intervalo = setInterval(() => setHeroIdx((atual) => atual + 1), TROCA_DE_CANAL_MS);
    return () => clearInterval(intervalo);
  }, [totalDeCanais]);

  const canalAtivo = totalDeCanais > 0 ? heroIdx % totalDeCanais : 0;
  const destaque = totalDeCanais > 0 ? canais[canalAtivo] : null;
  const proximaSessaoDestaque = destaque?.sessoes[0];

  // Hero e grade seguem na tela enquanto o próximo resultado não chega. Condicioná-los ao estado
  // de carregamento fazia a página encolher de uns 2000px pra uns 400px a cada tecla digitada ou
  // troca de sala; o navegador então cortava `scrollY` pro novo máximo e o visitante ia parar no
  // topo, longe da grade que estava lendo — sem ninguém ter chamado `scrollTo`.
  const temResultados = filmes.length > 0;
  const recarregando = estado === 'loading' && temResultados;
  // Só a grade escurece: o aparelho é a moldura da página, não o resultado que mudou, e escurecer
  // a maior superfície escura da tela a cada tecla digitada era a piscada que se via.
  //
  // O `delay-200` é o que faz a resposta rápida não piscar nada: a transição só começa a pintar
  // depois de 200ms parada em `loading`, e uma resposta que chega antes disso devolve a classe
  // normal antes da primeira quadro do fade. Atraso em CSS, sem `setTimeout` a limpar.
  const classeDaGrade = recarregando
    ? 'opacity-70 transition-opacity duration-150 delay-200'
    : 'transition-opacity duration-150';

  // O tubo continua ligado quando não há o que exibir: TV de tubo sem sinal mostra chuvisco, não
  // desaparece da sala. Desmontá-la derrubava a altura do documento e devolvia o pulo de rolagem
  // que o bloco acima existe pra evitar — nos caminhos que ele não cobria.
  //
  // A condição é "não há destaque e já houve resposta", não `estado === 'vazio'`: sair do vazio
  // recarrega em `loading` com a lista ainda vazia, e amarrar o tubo a um estado só o deixava
  // apagar justamente nessa passagem — a tela inteira piscava no clique de LIMPAR FILTROS.
  const semSinal = !destaque && jaRespondeu;
  const falhou = estado === 'erro';
  const temFiltro = Boolean(busca || salaId);
  // O nome da sala vem da lista já carregada, não da sessão: no vazio não há sessão nenhuma de onde
  // tirá-lo. Sala fora da lista (ou lista fora do ar) degrada pro genérico em vez de sumir o motivo.
  const salaFiltrada = salas.find((sala) => String(sala.id) === salaId);
  const ondeNaoAchou = salaFiltrada ? `na ${nomeExibidoDaSala(salaFiltrada.nome)}` : salaId ? 'nesta sala' : '';
  // Dizer qual filtro esvaziou a tela, não só que esvaziou: com busca e sala ligadas ao mesmo
  // tempo, "nenhum filme encontrado" não conta qual dos dois desfazer.
  const motivoSemSinal = temFiltro
    ? `Nada em cartaz ${[ondeNaoAchou, busca && `pra "${busca}"`].filter(Boolean).join(' ')}.`
    : 'Nenhuma sessão disponível no momento.';

  return (
    <PageShell>
      {(destaque || semSinal) && (
        <TvDeTubo
          posterUrl={destaque?.posterUrl ?? null}
          semSinal={semSinal}
          totalDeCanais={totalDeCanais}
          canalAtivo={canalAtivo}
          onTrocarCanal={setHeroIdx}
        >
          {destaque ? (
            <>
              <div className="font-mono text-lg tracking-[2px] text-cyan-400 sm:text-xl sm:tracking-[3px]">
                ▶ TOCANDO AGORA<span className="hidden sm:inline"> · CANAL 35</span>
              </div>
              <h1 className="max-w-[560px] font-display text-[clamp(26px,5.4cqw,60px)] leading-[0.92] text-flame-400 [text-shadow:4px_4px_0_var(--color-flame-600),8px_8px_0_rgba(0,0,0,0.45)]">
                {destaque.titulo}
              </h1>
              {proximaSessaoDestaque && (
                <div className="flex flex-wrap items-center gap-3 text-sm font-bold tracking-[1.4px] text-paper-100">
                  <span>{proximaSessaoDestaque.salaNome}</span>
                  <span className="text-white/30">/</span>
                  <span>{new Date(proximaSessaoDestaque.dataHora).toLocaleString('pt-BR')}</span>
                  <span className="text-white/30">/</span>
                  <span>{formatarPreco(proximaSessaoDestaque.preco)}</span>
                </div>
              )}
              {proximaSessaoDestaque?.sinopse && (
                <p className="line-clamp-2 max-w-[430px] text-[15px] leading-relaxed text-[#CFC5B8]">
                  {proximaSessaoDestaque.sinopse}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-3">
                <Link to={`/filmes/${destaque.tmdbId}`} className={buttonClass('primary', 'px-6 py-3')}>
                  COMPRAR INGRESSO
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="font-mono text-lg tracking-[2px] text-flame-400 sm:text-xl sm:tracking-[3px]">
                ⚠ CANAL 35<span className="hidden sm:inline"> · FORA DO AR</span>
              </div>
              <h1 className="max-w-[560px] font-display text-[clamp(26px,5.4cqw,60px)] leading-[0.92] text-paper-100 [text-shadow:4px_4px_0_#3B352F,8px_8px_0_rgba(0,0,0,0.45)]">
                SEM SINAL
              </h1>
              {/* `alert` só na falha: vazio por filtro é resultado, não erro, e anunciar
                  cada filtro sem resultado como alerta acaba treinando quem ouve a
                  ignorar o que é alerta de verdade. */}
              {falhou ? (
                <p role="alert" className="max-w-[430px] text-[15px] leading-relaxed text-[#CFC5B8]">
                  Não foi possível carregar as sessões agora.
                </p>
              ) : (
                <p role="status" className="max-w-[430px] text-[15px] leading-relaxed text-[#CFC5B8]">
                  {motivoSemSinal}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-3">
                {/* Recarregar não muda o resultado de um filtro que não casa com nada —
                    ali a saída é desfazer o filtro. Na falha é o contrário. */}
                {temFiltro && !falhou ? (
                  <button
                    type="button"
                    onClick={() => filtrar({ q: '', sala: '' })}
                    className={buttonClass('primary', 'px-6 py-3')}
                  >
                    LIMPAR FILTROS
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setTentativa((atual) => atual + 1)}
                    className={buttonClass('primary', 'px-6 py-3')}
                  >
                    TENTAR NOVAMENTE
                  </button>
                )}
              </div>
            </>
          )}
        </TvDeTubo>
      )}

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6">
        {/* Título e controles em extremidades opostas da mesma faixa. `flex-wrap` em vez de
            breakpoint: quando os dois não cabem lado a lado, o grupo de controles desce inteiro pra
            linha de baixo mantendo o mesmo gap — não há largura mágica a acertar, quem decide é o
            espaço que sobrou. */}
        <div className="flex flex-wrap items-end justify-between gap-5">
          {/* `whitespace-nowrap` só a partir de sm: empilhado o título não divide linha com
              ninguém, e travado em uma linha ele vazaria da tela num aparelho de 320px. */}
          <SectionTitle className="shrink-0 sm:whitespace-nowrap">O QUE TÁ PASSANDO?</SectionTitle>

          <div className="flex flex-wrap items-center gap-[14px]">
            <CampoDeBusca
              className="w-[240px] max-w-full"
              valor={busca}
              onBuscar={(termo) => filtrar({ q: termo.trim() })}
              label="Buscar sessão"
              placeholder="Buscar filme…"
            />
            {/* Sem a lista, o seletor não teria o que oferecer além da opção de desfazer a si
                mesmo. Dizer que está fora do ar é mais honesto que deixar um controle que abre
                vazio — e a busca por texto ao lado continua servindo. */}
            {salasIndisponiveis ? (
              <p className="w-[220px] max-w-full font-mono text-sm text-[#6D655B]">Filtro de sala indisponível.</p>
            ) : (
              <SeletorDeOpcao
                // 220px iguala gatilho e painel. Sem piso, "SALA 2 — DRIVE-IN" era cortado no botão
                // enquanto aparecia inteiro na lista aberta logo abaixo.
                className="w-[220px] max-w-full"
                variante="filtro"
                labelOculto
                label="Filtrar por sala"
                opcoes={opcoesDeSala}
                valor={salaId}
                placeholder="TODAS AS SALAS"
                onEscolher={(valor) => filtrar({ sala: valor })}
              />
            )}
          </div>
        </div>

        {/* Só até a primeira resposta, que é quando o aparelho ainda não está no ar. Dali em diante
            o vazio e a falha moram no tubo, e quem avisa que há coisa nova a caminho é o `aria-busy`
            da grade — sem tirar nada do lugar. */}
        {!jaRespondeu && <p className="mt-8 font-mono text-lg text-ink-950/60">Carregando sessões…</p>}

        {/* 150px de piso no mobile: com os 220px do desktop, a grade cai pra uma coluna só num
            aparelho estreito e o pôster 2/3 ocupa a tela inteira, um filme por rolagem. */}
        {temResultados && (
          <div
            data-testid="grade-filmes"
            aria-busy={recarregando}
            className={`mt-8 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-8 ${classeDaGrade}`}
          >
            {filmes.map((filme) => (
              <CardDeFilme key={filme.tmdbId} filme={filme} />
            ))}
          </div>
        )}

        {estado === 'pronto' && (
          <Paginacao rotulo="sessões" pagina={pagina} totalPaginas={totalPaginas} onIr={irPara} />
        )}
      </div>
    </PageShell>
  );
}
