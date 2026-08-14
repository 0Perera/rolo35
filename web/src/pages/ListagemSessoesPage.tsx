import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listarSalas, listarSessoesPublicadas, type Sala, type SessaoPublicada } from '../api/sessoes';
import { buttonClass } from '../components/Button';
import { CampoDeBusca } from '../components/CampoDeBusca';
import { PageShell } from '../components/PageShell';
import { Paginacao } from '../components/Paginacao';
import { SectionTitle } from '../components/SectionTitle';
import { SeletorDeOpcao } from '../components/SeletorDeOpcao';
import { nomeExibidoDaSala } from '../lib/salas';
import {
  contagemDeSessoes,
  formatarPreco,
  precoDoFilme,
  resumoDeSalas,
  rotuloDeDia,
  rotuloDeHora,
} from '../lib/sessoes';

type Estado = 'loading' | 'vazio' | 'erro' | 'pronto';

interface FilmeAgrupado {
  tmdbId: number;
  titulo: string;
  posterUrl: string | null;
  dataEstreia: string | null;
  sessoes: SessaoPublicada[];
}

const MAXIMO_DE_CANAIS = 6;
const TROCA_DE_CANAL_MS = 7000;

const PALETA_ACENTO =['#F26522', '#E32B21', '#2E7D46', '#7ED9F2', '#FFC414', '#E85D9E', '#8A8F98', '#123A5C'];

/** `matchMedia` não existe no jsdom, então a checagem é defensiva. */
function prefereMenosAnimacao(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function corPorFilme(tmdbId: number): string {
  return PALETA_ACENTO[Math.abs(tmdbId) % PALETA_ACENTO.length];
}

function agruparPorFilme(sessoes: SessaoPublicada[]): FilmeAgrupado[] {
  const porFilme = new Map<number, FilmeAgrupado>();

  for (const sessao of sessoes) {
    const existente = porFilme.get(sessao.tmdbId);
    if (existente) {
      existente.sessoes.push(sessao);
    } else {
      porFilme.set(sessao.tmdbId, {
        tmdbId: sessao.tmdbId,
        titulo: sessao.titulo,
        posterUrl: sessao.posterUrl,
        dataEstreia: sessao.dataEstreia,
        sessoes: [sessao],
      });
    }
  }

  for (const filme of porFilme.values()) {
    filme.sessoes.sort((a, b) => a.dataHora.localeCompare(b.dataHora));
  }

  return Array.from(porFilme.values());
}

/** "A partir de" só entra quando o filme tem sessões com preços diferentes. */
function precoDoCard(sessoes: SessaoPublicada[]): string {
  const preco = precoDoFilme(sessoes);
  return preco.aPartirDe ? `A PARTIR DE ${preco.texto}` : preco.texto;
}

/** Ano de estreia, sala e nº de sessões — o que o snapshot do TMDb em `sessoes` permite mostrar. */
function metaDoFilme(filme: FilmeAgrupado): string {
  return [filme.dataEstreia?.slice(0, 4), resumoDeSalas(filme.sessoes), contagemDeSessoes(filme.sessoes.length)]
    .filter(Boolean)
    .join(' · ');
}

const TAMANHO_PAGINA = 12;

export function ListagemSessoesPage() {
  const [parametros, setParametros] = useSearchParams();
  const busca = parametros.get('q') ?? '';
  const salaId = parametros.get('sala') ?? '';
  const pagina = Number(parametros.get('pagina') ?? '0');

  const [sessoes, setSessoes] = useState<SessaoPublicada[]>([]);
  const [salas, setSalas] = useState<Sala[]>([]);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [estado, setEstado] = useState<Estado>('loading');
  const [tentativa, setTentativa] = useState(0);
  const [heroIdx, setHeroIdx] = useState(0);

  // As salas não dependem da busca nem da página, então são buscadas uma vez só. Uma falha aqui
  // deixa o filtro vazio, mas não pode derrubar a vitrine — o catálogo é o conteúdo principal.
  useEffect(() => {
    let ativo = true;
    listarSalas()
      .then((resultado) => {
        if (ativo) {
          setSalas(resultado);
        }
      })
      .catch(() => {});
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
      })
      .catch(() => {
        if (ativo) {
          setEstado('erro');
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

  function filtrarPorSala(valor: string) {
    const proximos = new URLSearchParams(parametros);
    if (valor) {
      proximos.set('sala', valor);
    } else {
      proximos.delete('sala');
    }
    proximos.delete('pagina');
    setParametros(proximos);
    setHeroIdx(0);
  }

  function limparFiltros() {
    const proximos = new URLSearchParams(parametros);
    proximos.delete('q');
    proximos.delete('sala');
    proximos.delete('pagina');
    setParametros(proximos);
  }

  function irPara(novaPagina: number) {
    const proximos = new URLSearchParams(parametros);
    proximos.set('pagina', String(novaPagina));
    setParametros(proximos);
    setHeroIdx(0);
  }

  function buscar(termo: string) {
    const proximos = new URLSearchParams(parametros);
    if (termo.trim()) {
      proximos.set('q', termo.trim());
    } else {
      proximos.delete('q');
    }
    proximos.delete('pagina');
    setParametros(proximos);
    setHeroIdx(0);
  }

  const totalDeCanais = Math.min(agruparPorFilme(sessoes).length, MAXIMO_DE_CANAIS);

  // A TV troca de canal sozinha, como uma vitrine de cinema. Fica parada quando só há um
  // filme em cartaz e quando o sistema pede menos animação.
  useEffect(() => {
    if (totalDeCanais < 2 || prefereMenosAnimacao()) {
      return;
    }
    const intervalo = setInterval(() => setHeroIdx((atual) => atual + 1), TROCA_DE_CANAL_MS);
    return () => clearInterval(intervalo);
  }, [totalDeCanais]);

  const filmes = agruparPorFilme(sessoes);
  // O hero do protótipo tem seis canais; com mais filmes em cartaz a fileira de bolinhas
  // viraria uma régua sem serventia — o resto do catálogo aparece na grade abaixo.
  const canais = filmes.slice(0, MAXIMO_DE_CANAIS);
  const destaque = canais.length > 0 ? canais[heroIdx % canais.length] : null;
  const proximaSessaoDestaque = destaque?.sessoes[0];

  // Hero e grade seguem na tela enquanto o próximo resultado não chega. Condicioná-los ao estado
  // de carregamento fazia a página encolher de uns 2000px pra uns 400px a cada tecla digitada ou
  // troca de sala; o navegador então cortava `scrollY` pro novo máximo e o visitante ia parar no
  // topo, longe da grade que estava lendo — sem ninguém ter chamado `scrollTo`.
  const temResultados = filmes.length > 0;
  const recarregando = estado === 'loading' && temResultados;
  // Só o suficiente pra troca de filtro não parecer que não funcionou; sumir com o conteúdo
  // devolveria o pulo de rolagem que este bloco existe pra evitar.
  const classeRecarregando = recarregando ? 'opacity-60 transition-opacity' : 'transition-opacity';

  return (
    <PageShell>
      {destaque && (
        <section
          data-testid="hero-vitrine"
          className={`flex justify-center border-b-[3px] border-ink-950 px-4 py-8 sm:px-6 sm:py-11 ${classeRecarregando}`}
          style={{
            backgroundImage: 'radial-gradient(120% 90% at 50% 0%, #2A2130 0%, #171219 60%, #100C13 100%)',
          }}
        >
          <div className="w-full max-w-[1080px]">
            <div
              className="relative p-[clamp(16px,4cqw,30px)] pb-[clamp(20px,5cqw,40px)]"
              style={{
                backgroundImage: 'linear-gradient(165deg, #6C6459 0%, #3B352F 45%, #221E1A 100%)',
                boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.18), 0 26px 60px rgba(0,0,0,0.55)',
                border: '3px solid #0D0A0F',
                borderRadius: 'clamp(22px,5cqw,46px) clamp(22px,5cqw,46px) clamp(14px,3cqw,30px) clamp(14px,3cqw,30px)',
              }}
            >
              {/* A borda do tubo encolhe no mobile: 12px de cada lado custam caro numa tela de 390px. */}
              <div
                className="relative animate-[rolo-flick_7s_infinite] overflow-hidden rounded-[28px] border-[8px] border-[#14100E] sm:border-[12px]"
                style={{ background: '#05060A', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.9)' }}
              >
                <div className="relative">
                  {destaque.posterUrl && (
                    <img
                      src={destaque.posterUrl}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  {/* O véu horizontal só funciona quando o texto ocupa a metade esquerda. No mobile ele
                      atravessa a largura toda, então lá o escurecimento vem de cima pra baixo. */}
                  <div
                    className="pointer-events-none absolute inset-0 sm:hidden"
                    style={{
                      backgroundImage:
                        'linear-gradient(180deg, rgba(5,6,10,0.62) 0%, rgba(5,6,10,0.86) 42%, rgba(5,6,10,0.94) 100%)',
                    }}
                  />
                  <div
                    className="pointer-events-none absolute inset-0 hidden sm:block"
                    style={{
                      backgroundImage:
                        'linear-gradient(90deg, rgba(5,6,10,0.94) 0%, rgba(5,6,10,0.72) 38%, rgba(5,6,10,0.1) 70%, rgba(126,217,242,0.12) 100%)',
                    }}
                  />
                  <div
                    className="pointer-events-none absolute inset-0 opacity-50"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(0deg, rgba(0,0,0,0.5) 0px, rgba(0,0,0,0.5) 1px, transparent 1px, transparent 4px)',
                    }}
                  />
                  <div
                    aria-hidden
                    className="pointer-events-none absolute left-0 right-0 h-[90px] animate-[rolo-scan_6s_linear_infinite] opacity-[0.16]"
                    style={{ backgroundImage: 'linear-gradient(180deg, transparent, #7ED9F2, transparent)' }}
                  />

                  {/* O texto fica no fluxo (e é ele quem carrega o `min-h`), não em `absolute`: como
                      absoluto ele não empurrava altura nenhuma e um título longo em tela estreita era
                      cortado pelo `overflow-hidden` do tubo. O pôster atrás estica junto via `inset-0`.
                      O `pb` extra no mobile reserva a faixa das bolinhas de canal. */}
                  <div className="relative flex min-h-[clamp(340px,92cqw,460px)] flex-col justify-center gap-[clamp(8px,1.4cqw,18px)] px-[clamp(16px,4cqw,56px)] py-8 pb-14 sm:pb-8">
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
                  </div>

                  {canais.length > 1 && (
                    // A bolinha continua com 10px, mas quem recebe o toque é o botão de 24px em volta:
                    // 10px é alvo pequeno demais pro dedo.
                    <div className="absolute right-2 bottom-2 flex items-center sm:right-6 sm:bottom-3">
                      {canais.map((filme, i) => (
                        <button
                          key={filme.tmdbId}
                          type="button"
                          aria-label={`Destaque ${i + 1}`}
                          onClick={() => setHeroIdx(i)}
                          className="grid h-6 w-6 place-items-center sm:h-7 sm:w-7"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full border-2 border-paper-100"
                            style={{ background: i === heroIdx % canais.length ? '#FFC414' : 'transparent' }}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* A grade do alto-falante sai no mobile: ela e os botões não cabem na mesma linha
                  numa tela estreita e o nome do aparelho fica espremido. */}
              <div className="mt-[18px] flex items-center justify-between gap-3 px-1 sm:px-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="hidden h-3 w-[62px] rounded-sm sm:block" style={{ background: '#14100E' }} />
                  <div className="truncate font-mono text-base tracking-[2px] text-[#C9BCA9] sm:text-lg">
                    ROLO 35 TRINITRON
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  <div
                    className="h-[26px] w-[26px] rounded-full border-2"
                    style={{ backgroundImage: 'linear-gradient(150deg, #8A8175, #423C35)', borderColor: '#14100E' }}
                  />
                  <div
                    className="h-[26px] w-[26px] rounded-full border-2"
                    style={{ backgroundImage: 'linear-gradient(150deg, #8A8175, #423C35)', borderColor: '#14100E' }}
                  />
                  <div
                    aria-hidden
                    className="h-2.5 w-2.5 animate-[rolo-blink_2.4s_infinite] rounded-full"
                    style={{ background: '#E32B21', boxShadow: '0 0 10px #E32B21' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
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
              onBuscar={buscar}
              label="Buscar sessão"
              placeholder="Buscar filme…"
            />
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
              onEscolher={filtrarPorSala}
            />
          </div>
        </div>

        {/* Só na primeira carga: com resultado já na tela, quem avisa que há coisa nova a caminho é
            o `aria-busy` da grade, sem tirar nada do lugar. */}
        {estado === 'loading' && !temResultados && (
          <p className="mt-8 font-mono text-lg text-ink-950/60">Carregando sessões…</p>
        )}
        {/* Caixa tracejada no lugar da grade, não uma frase solta: o vazio ocupa o mesmo espaço que
            o conteúdo ocuparia, então a tela não parece meio carregada. */}
        {estado === 'vazio' && (
          <div className="mt-8 border-[3px] border-dashed border-[#C7B694] p-10 text-center">
            <p className="font-mono text-xl text-[#6D655B]">
              {busca || salaId ? 'Nenhum filme encontrado em cartaz.' : 'Nenhuma sessão disponível no momento.'}
            </p>
            {(busca || salaId) && (
              <button type="button" onClick={limparFiltros} className={buttonClass('secondary', 'mt-5')}>
                LIMPAR FILTROS
              </button>
            )}
          </div>
        )}
        {estado === 'erro' && (
          <p role="alert" className="mt-8 font-mono text-lg text-flame-600">
            Não foi possível carregar as sessões agora.
          </p>
        )}

        {/* "Tentar novamente" só faz sentido quando a lista falhou. No vazio por filtro, o caminho
            de saída é limpar o filtro — recarregar traria o mesmo nada. */}
        {estado === 'erro' && (
          <button type="button" onClick={() => setTentativa((atual) => atual + 1)} className={buttonClass('secondary', 'mt-4')}>
            TENTAR NOVAMENTE
          </button>
        )}
        {estado === 'vazio' && !busca && !salaId && (
          <button type="button" onClick={() => setTentativa((atual) => atual + 1)} className={buttonClass('secondary', 'mt-4')}>
            TENTAR NOVAMENTE
          </button>
        )}

        {/* 150px de piso no mobile: com os 220px do desktop, a grade cai pra uma coluna só num
            aparelho estreito e o pôster 2/3 ocupa a tela inteira, um filme por rolagem. */}
        {temResultados && (
          <div
            data-testid="grade-filmes"
            aria-busy={recarregando}
            className={`mt-8 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5 sm:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] sm:gap-8 ${classeRecarregando}`}
          >
            {filmes.map((filme) => {
              const esgotado = filme.sessoes.every((sessao) => sessao.esgotada);
              return (
                <article key={filme.tmdbId} className="flex h-full flex-col">
                  <Link
                    to={`/filmes/${filme.tmdbId}`}
                    aria-label={filme.titulo}
                    className="relative block border-[3px] border-ink-950 bg-ink-950 shadow-[7px_7px_0_rgba(23,18,25,0.85)] transition hover:-translate-x-0.5 hover:-translate-y-[3px]"
                  >
                    <div className="relative aspect-[2/3] w-full overflow-hidden">
                      {filme.posterUrl ? (
                        <img
                          src={filme.posterUrl}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-ink-900" />
                      )}
                      <div
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-3.5"
                        style={{ backgroundImage: 'linear-gradient(90deg, rgba(0,0,0,0.55), transparent)' }}
                      />
                    </div>
                    <div
                      aria-hidden
                      className="absolute bottom-0 left-0 right-0 h-1.5"
                      style={{ background: corPorFilme(filme.tmdbId) }}
                    />
                    {esgotado && (
                      <span className="absolute top-2 left-2 border-2 border-flame-600 bg-ink-950/80 px-2 py-0.5 text-xs tracking-wide text-flame-600">
                        Esgotada
                      </span>
                    )}
                  </Link>

                  <h2 className="mt-3.5 font-display text-sm leading-tight tracking-[0.3px]">{filme.titulo}</h2>
                  <p className="mt-1.5 font-mono text-base leading-snug tracking-wide text-ink-950/50">
                    {metaDoFilme(filme)}
                  </p>
                  <p className="mb-3 font-mono text-base leading-snug tracking-wide text-navy-700">
                    {rotuloDeDia(filme.sessoes[0].dataHora)} · {rotuloDeHora(filme.sessoes[0].dataHora)} ·{' '}
                    {precoDoCard(filme.sessoes)}
                  </p>

                  <Link to={`/filmes/${filme.tmdbId}`} className={buttonClass('ticket', 'mt-auto w-full')}>
                    🎟 {esgotado ? 'VER SESSÕES' : 'COMPRAR INGRESSO'}
                  </Link>
                </article>
              );
            })}
          </div>
        )}

        {estado === 'pronto' && (
          <Paginacao rotulo="sessões" pagina={pagina} totalPaginas={totalPaginas} onIr={irPara} />
        )}
      </div>
    </PageShell>
  );
}
