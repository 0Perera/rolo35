import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { listarSessoesPublicadas, type SessaoPublicada } from '../api/sessoes';
import { buttonClass } from '../components/Button';
import { PageShell } from '../components/PageShell';
import { contagemDeSessoes, precoDoFilme, resumoDeSalas, rotuloDeDia, rotuloDeHora } from '../lib/sessoes';

type Estado = 'loading' | 'erro' | 'pronto' | 'nao-encontrado';

function agruparPorDia(sessoes: SessaoPublicada[]): { dia: string; sessoes: SessaoPublicada[] }[] {
  const porDia = new Map<string, SessaoPublicada[]>();
  const ordenadas = [...sessoes].sort((a, b) => a.dataHora.localeCompare(b.dataHora));

  for (const sessao of ordenadas) {
    const dia = rotuloDeDia(sessao.dataHora);
    const lista = porDia.get(dia);
    if (lista) {
      lista.push(sessao);
    } else {
      porDia.set(dia, [sessao]);
    }
  }

  return Array.from(porDia.entries()).map(([dia, sessoesDoDia]) => ({ dia, sessoes: sessoesDoDia }));
}

export function FilmeDetalhePage() {
  const { tmdbId } = useParams<{ tmdbId: string }>();
  const navigate = useNavigate();
  const [sessoesDoFilme, setSessoesDoFilme] = useState<SessaoPublicada[]>([]);
  const [estado, setEstado] = useState<Estado>('loading');

  useEffect(() => {
    let ativo = true;
    setEstado('loading');
    listarSessoesPublicadas()
      .then((resultado) => {
        if (!ativo) {
          return;
        }
        const doFilme = resultado.filter((sessao) => String(sessao.tmdbId) === tmdbId);
        setSessoesDoFilme(doFilme);
        setEstado(doFilme.length === 0 ? 'nao-encontrado' : 'pronto');
      })
      .catch(() => {
        if (ativo) {
          setEstado('erro');
        }
      });
    return () => {
      ativo = false;
    };
  }, [tmdbId]);

  function escolherHorario(sessao: SessaoPublicada) {
    navigate(`/sessoes/${sessao.id}/assentos`);
  }

  const preco = sessoesDoFilme.length > 0 ? precoDoFilme(sessoesDoFilme) : null;

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 xl:max-w-[1440px]">
      <Link to="/" className="font-mono text-lg tracking-wide text-ink-950/60 hover:text-flame-600">
        ◀ VOLTAR PRA PRATELEIRA
      </Link>

      {estado === 'loading' && <p className="mt-6 font-mono text-lg text-ink-950/60">Carregando…</p>}
      {estado === 'erro' && (
        <p role="alert" className="mt-6 font-mono text-lg text-flame-600">
          Não foi possível carregar esse filme agora.
        </p>
      )}
      {estado === 'nao-encontrado' && (
        <p className="mt-6 font-mono text-lg text-ink-950/60">Nenhuma sessão em cartaz pra esse filme.</p>
      )}

      {estado === 'pronto' && preco && (
        <div className="mt-6 flex flex-wrap items-start gap-9 xl:gap-12">
          {/* O pôster cresce junto do container em tela grande: a 300px fixos ele vira uma miniatura
              com meia tela vazia embaixo, e o pôster é o que identifica o filme aqui. */}
          <div className="w-full flex-[0_1_300px] border-[3px] border-ink-950 bg-ink-950 shadow-[9px_9px_0_rgba(23,18,25,0.85)] xl:flex-[0_1_400px]">
            <div className="relative aspect-[2/3]">
              {sessoesDoFilme[0].posterUrl ? (
                <img
                  src={sessoesDoFilme[0].posterUrl}
                  alt={sessoesDoFilme[0].titulo}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-ink-900" />
              )}
            </div>
          </div>

          <div className="min-w-0 flex-[1_1_380px]">
            <h1 className="font-display text-[clamp(28px,4.4cqw,52px)] leading-none text-flame-600 [text-shadow:4px_4px_0_var(--color-flame-400)]">
              {sessoesDoFilme[0].titulo}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-bold tracking-[1.4px] text-ink-950/70">
              {sessoesDoFilme[0].dataEstreia && (
                <span className="border-2 border-navy-700 px-2 py-0.5 text-navy-700">
                  {sessoesDoFilme[0].dataEstreia.slice(0, 4)}
                </span>
              )}
              <span>{resumoDeSalas(sessoesDoFilme)}</span>
              <span className="text-ink-950/30">/</span>
              <span>{contagemDeSessoes(sessoesDoFilme.length)}</span>
              <span className="text-ink-950/30">/</span>
              <span className="text-flame-600">
                {preco.aPartirDe ? `A PARTIR DE ${preco.texto}` : preco.texto}
              </span>
            </div>

            {sessoesDoFilme[0].sinopse && (
              <p className="mt-5 max-w-xl text-base leading-relaxed xl:max-w-2xl xl:text-lg">{sessoesDoFilme[0].sinopse}</p>
            )}

            <div className="my-7 h-[3px] bg-ink-950" />
            <h2 className="mb-4 font-display text-xl xl:text-2xl">ESCOLHA A SESSÃO</h2>

            {agruparPorDia(sessoesDoFilme).map(({ dia, sessoes: sessoesDoDia }) => (
              <div
                key={dia}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t-2 border-dashed border-[#C7B694] py-4 sm:gap-x-6"
              >
                {/* Coluna do dia mais estreita que os 150px do protótipo: lá cada dia tem três ou
                    quatro horários preenchendo a linha; aqui um dia com uma sessão só deixaria
                    um vão entre a data e o único botão. */}
                <div className="shrink-0 font-mono text-xl tracking-wide uppercase sm:w-[104px] xl:w-[124px] xl:text-2xl">{dia}</div>
                <div className="flex flex-wrap gap-3">
                  {sessoesDoDia.map((sessao) => (
                    <button
                      key={sessao.id}
                      type="button"
                      disabled={sessao.esgotada}
                      onClick={() => escolherHorario(sessao)}
                      className={buttonClass('horario', 'xl:px-6 xl:py-4')}
                    >
                      <span className="font-display text-[17px] leading-tight">{rotuloDeHora(sessao.dataHora)}</span>
                      <span className="font-mono text-[15px] tracking-wide text-ink-950/60">
                        {sessao.esgotada ? 'ESGOTADA' : sessao.salaNome.toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </PageShell>
  );
}
