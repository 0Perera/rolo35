import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listarSessoesPublicadas, type SessaoPublicada } from '../api/sessoes';
import { buttonClass } from '../components/Button';
import { PageShell } from '../components/PageShell';

type Estado = 'loading' | 'vazio' | 'erro' | 'pronto';

interface FilmeAgrupado {
  tmdbId: number;
  titulo: string;
  posterUrl: string | null;
  sessoes: SessaoPublicada[];
}

const PALETA_ACENTO = ['#F26522', '#E32B21', '#2E7D46', '#7ED9F2', '#FFC414', '#E85D9E', '#8A8F98', '#123A5C'];

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
        sessoes: [sessao],
      });
    }
  }

  return Array.from(porFilme.values());
}

export function ListagemSessoesPage() {
  const [sessoes, setSessoes] = useState<SessaoPublicada[]>([]);
  const [estado, setEstado] = useState<Estado>('loading');
  const [tentativa, setTentativa] = useState(0);
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    let ativo = true;
    setEstado('loading');
    listarSessoesPublicadas()
      .then((resultado) => {
        if (!ativo) {
          return;
        }
        setSessoes(resultado);
        setEstado(resultado.length === 0 ? 'vazio' : 'pronto');
      })
      .catch(() => {
        if (ativo) {
          setEstado('erro');
        }
      });
    return () => {
      ativo = false;
    };
  }, [tentativa]);

  const filmes = agruparPorFilme(sessoes);
  const destaque = filmes.length > 0 ? filmes[heroIdx % filmes.length] : null;
  const proximaSessaoDestaque = destaque?.sessoes[0];

  return (
    <PageShell>
      {estado === 'pronto' && destaque && (
        <section
          className="flex justify-center border-b-[3px] border-ink-950 px-6 py-11"
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
              <div
                className="relative animate-[rolo-flick_7s_infinite] overflow-hidden rounded-[28px]"
                style={{ background: '#05060A', border: '12px solid #14100E', boxShadow: 'inset 0 0 60px rgba(0,0,0,0.9)' }}
              >
                <div className="relative min-h-[clamp(300px,92cqw,460px)]">
                  {destaque.posterUrl && (
                    <img
                      src={destaque.posterUrl}
                      alt=""
                      aria-hidden
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}
                  <div
                    className="pointer-events-none absolute inset-0"
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

                  <div className="absolute inset-0 flex flex-col justify-center gap-[clamp(8px,1.4cqw,18px)] px-[clamp(18px,4cqw,56px)]">
                    <div className="font-mono text-xl tracking-[3px] text-cyan-400">▶ TOCANDO AGORA · CANAL 35</div>
                    <h1 className="max-w-[560px] font-display text-[clamp(30px,5.4cqw,60px)] leading-[0.92] text-flame-400 [text-shadow:4px_4px_0_var(--color-flame-600),8px_8px_0_rgba(0,0,0,0.45)]">
                      {destaque.titulo}
                    </h1>
                    {proximaSessaoDestaque && (
                      <div className="flex flex-wrap items-center gap-3 text-sm font-bold tracking-[1.4px] text-paper-100">
                        <span>{proximaSessaoDestaque.salaNome}</span>
                        <span className="text-white/30">/</span>
                        <span>{new Date(proximaSessaoDestaque.dataHora).toLocaleString('pt-BR')}</span>
                        <span className="text-white/30">/</span>
                        <span>R$ {proximaSessaoDestaque.preco.toFixed(2).replace('.', ',')}</span>
                      </div>
                    )}
                    {proximaSessaoDestaque?.sinopse && (
                      <p className="max-w-[430px] text-[15px] leading-relaxed text-[#CFC5B8]">
                        {proximaSessaoDestaque.sinopse}
                      </p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-3">
                      <Link to={`/filmes/${destaque.tmdbId}`} className={buttonClass('primary', 'px-6 py-3')}>
                        COMPRAR INGRESSO
                      </Link>
                    </div>
                  </div>

                  {filmes.length > 1 && (
                    <div className="absolute bottom-5 right-8 flex items-center gap-2.5">
                      {filmes.map((filme, i) => (
                        <button
                          key={filme.tmdbId}
                          type="button"
                          aria-label={`Destaque ${i + 1}`}
                          onClick={() => setHeroIdx(i)}
                          className="h-2.5 w-2.5 rounded-full border-2 border-paper-100"
                          style={{ background: i === heroIdx % filmes.length ? '#FFC414' : 'transparent' }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-[18px] flex items-center justify-between px-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-3 w-[62px] rounded-sm" style={{ background: '#14100E' }} />
                  <div className="font-mono text-lg tracking-[2px] text-[#C9BCA9]">ROLO 35 TRINITRON</div>
                </div>
                <div className="flex items-center gap-3">
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

      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-end justify-between gap-5">
          <div>
            <h1 className="font-display text-[clamp(26px,4.2cqw,42px)] text-flame-600 [text-shadow:3px_3px_0_var(--color-flame-400)]">
              O QUE TÁ PASSANDO?
            </h1>
            <div className="mt-2.5 h-[5px] w-56 bg-gradient-to-r from-flame-600 to-flame-400" />
          </div>
        </div>

        {estado === 'loading' && <p className="mt-8 font-mono text-lg text-ink-950/60">Carregando sessões…</p>}
        {estado === 'vazio' && (
          <p className="mt-8 font-mono text-lg text-ink-950/60">Nenhuma sessão disponível no momento.</p>
        )}
        {estado === 'erro' && (
          <p role="alert" className="mt-8 font-mono text-lg text-flame-600">
            Não foi possível carregar as sessões agora.
          </p>
        )}

        {(estado === 'erro' || estado === 'vazio') && (
          <button type="button" onClick={() => setTentativa((atual) => atual + 1)} className={buttonClass('secondary', 'mt-4')}>
            TENTAR NOVAMENTE
          </button>
        )}

        {estado === 'pronto' && (
          <div
            data-testid="grade-filmes"
            className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-7"
          >
            {filmes.map((filme) => {
              const esgotado = filme.sessoes.every((sessao) => sessao.esgotada);
              return (
                <Link key={filme.tmdbId} to={`/filmes/${filme.tmdbId}`} className="flex flex-col">
                  <div className="relative border-[3px] border-ink-950 bg-ink-950 shadow-[7px_7px_0_rgba(23,18,25,0.85)]">
                    <div className="relative aspect-[2/3]">
                      {filme.posterUrl ? (
                        <img src={filme.posterUrl} alt={filme.titulo} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full bg-ink-900" />
                      )}
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-1.5" style={{ background: corPorFilme(filme.tmdbId) }} />
                    {esgotado && (
                      <span className="absolute top-2 left-2 border-2 border-flame-600 bg-ink-950/80 px-2 py-0.5 text-xs tracking-wide text-flame-600">
                        Esgotada
                      </span>
                    )}
                  </div>
                  <div className="mt-3.5 font-display text-sm leading-tight">{filme.titulo}</div>
                  <div className="mt-1.5 font-mono text-base tracking-wide text-ink-950/50">
                    {filme.sessoes.length === 1 ? '1 sessão' : `${filme.sessoes.length} sessões`}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
}
