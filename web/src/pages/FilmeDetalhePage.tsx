import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { listarSessoesPublicadas, type SessaoPublicada } from '../api/sessoes';
import { buttonClass } from '../components/Button';
import { PageShell } from '../components/PageShell';

type Estado = 'loading' | 'erro' | 'pronto' | 'nao-encontrado';

function agruparPorDia(sessoes: SessaoPublicada[]): { dia: string; sessoes: SessaoPublicada[] }[] {
  const porDia = new Map<string, SessaoPublicada[]>();

  for (const sessao of sessoes) {
    const dia = new Date(sessao.dataHora).toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    });
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
    navigate('/em-construcao', {
      state: {
        titulo: 'Mapa de assentos',
        mensagem: `A seleção de assentos pra "${sessao.titulo}" chega numa próxima entrega.`,
      },
    });
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-6 py-10">
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

      {estado === 'pronto' && (
        <div className="mt-6 flex flex-wrap items-start gap-9">
          <div className="w-full flex-[0_1_300px] border-[3px] border-ink-950 bg-ink-950 shadow-[9px_9px_0_rgba(23,18,25,0.85)]">
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
            {sessoesDoFilme[0].sinopse && (
              <p className="mt-5 max-w-xl text-base leading-relaxed">{sessoesDoFilme[0].sinopse}</p>
            )}

            <div className="my-7 h-[3px] bg-ink-950" />
            <h2 className="mb-4 font-display text-xl">ESCOLHA A SESSÃO</h2>

            {agruparPorDia(sessoesDoFilme).map(({ dia, sessoes: sessoesDoDia }) => (
              <div key={dia} className="flex flex-wrap items-center gap-5 border-t-2 border-dashed border-paper-line py-4">
                <div className="w-[150px] font-mono text-xl tracking-wide">{dia}</div>
                <div className="flex flex-wrap gap-3">
                  {sessoesDoDia.map((sessao) => (
                    <button
                      key={sessao.id}
                      type="button"
                      disabled={sessao.esgotada}
                      onClick={() => escolherHorario(sessao)}
                      className={buttonClass(
                        sessao.esgotada ? 'secondary' : 'primary',
                        'px-4 py-2.5 text-left disabled:hover:translate-x-0 disabled:hover:translate-y-0',
                      )}
                    >
                      <div className="font-display text-base">
                        {new Date(sessao.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="font-mono text-sm tracking-wide opacity-75">
                        {sessao.salaNome}
                        {sessao.esgotada ? ' · esgotada' : ''}
                      </div>
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
