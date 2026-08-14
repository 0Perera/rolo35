import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { SessaoExpiradaError } from '../api/client';
import { listarMeusIngressos, type IngressoResumo } from '../api/ingressos';
import { AcoesDoIngresso } from '../components/AcoesDoIngresso';
import { buttonClass } from '../components/Button';
import { CanhotoIngresso } from '../components/CanhotoIngresso';
import { PageShell } from '../components/PageShell';
import { Paginacao } from '../components/Paginacao';
import { SectionTitle } from '../components/SectionTitle';
import { SeloStatusIngresso } from '../components/SeloStatusIngresso';
import { useSessao } from '../lib/sessao';
import { rotuloDeDia, rotuloDeHora } from '../lib/sessoes';

/**
 * `sem-sessao` é distinto de `expirada`: um é quem nunca entrou, o outro é quem foi desconectado.
 * O `apiFetch` só levanta `SessaoExpiradaError` quando havia token pra recusar, então sem essa
 * separação o visitante caía em `erro` e lia "não foi possível carregar" — falha de servidor —
 * quando o que faltava era login.
 */
type Estado = 'loading' | 'sem-sessao' | 'vazio' | 'erro' | 'expirada' | 'pronto';

const TAMANHO_PAGINA = 12;

function assentoDe(ingresso: IngressoResumo): string {
  return `${ingresso.assentoFileira}${ingresso.assentoNumero}`;
}

/**
 * Linha da carteira. O card inteiro é clicável no handoff, mas botão dentro de botão não é HTML
 * válido: quem abre o detalhe é o bloco de texto (que ocupa quase toda a linha) e o compartilhar
 * fica ao lado, irmão dele. O realce de hover mora no `<li>`, então a linha toda reage ao mouse.
 */
function LinhaIngresso({ ingresso, onAbrir }: { ingresso: IngressoResumo; onAbrir: () => void }) {
  return (
    <li className="flex flex-wrap border-[3px] border-ink-950 bg-paper-50 shadow-[8px_8px_0_var(--color-ink-950)] transition hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[10px_10px_0_var(--color-ink-950)]">
      <div aria-hidden="true" className="w-3 bg-gradient-to-b from-flame-600 via-flame-500 to-flame-400" />
      <div className="flex flex-1 flex-wrap items-center justify-between gap-4 px-6 py-5">
        <button
          type="button"
          onClick={onAbrir}
          aria-label={`Ver ingresso de ${ingresso.sessaoTitulo}, assento ${assentoDe(ingresso)}`}
          className="min-w-0 flex-1 cursor-pointer text-left"
        >
          <span className="flex flex-wrap items-center gap-2.5">
            <span className="font-display text-lg leading-tight">{ingresso.sessaoTitulo}</span>
            <SeloStatusIngresso status={ingresso.status} />
          </span>
          <span className="mt-1.5 block font-mono text-base tracking-wide text-[#6D655B]">
            {rotuloDeDia(ingresso.dataHora)} · {rotuloDeHora(ingresso.dataHora)} ·{' '}
            {ingresso.salaNome.toUpperCase()} · ASSENTO {assentoDe(ingresso)}
          </span>
        </button>
        <AcoesDoIngresso codigo={ingresso.codigo} codigoCurto={ingresso.codigoCurto} />
      </div>
    </li>
  );
}

/**
 * Moldura dos três estados sem lista (sem login, sessão vencida, carteira vazia). Uma frase solta
 * no alto de uma página vazia lê como carregamento que falhou: a moldura diz que a tela está
 * inteira e só falta conteúdo, e dá ao convite o peso de destino, não de rodapé.
 *
 * `alerta` separa o que deu errado (sessão vencida) do que é só o estado normal da tela: leitor de
 * tela interrompe a leitura num `alert` e espera a vez num `status`.
 */
function PainelSemLista({
  titulo,
  texto,
  acao,
  alerta = false,
}: {
  titulo: string;
  texto: string;
  acao?: ReactNode;
  alerta?: boolean;
}) {
  return (
    <div
      role={alerta ? 'alert' : 'status'}
      className="mt-9 border-[3px] border-dashed border-[#C7B694] px-6 py-12 text-center"
    >
      <h2 className="font-display text-[clamp(20px,3cqw,28px)] leading-[1.15]">{titulo}</h2>
      {/* max-w em ch: linha de leitura curta, centralizada, em vez de uma faixa de texto de ponta
          a ponta da carteira. */}
      <p className="mx-auto mt-3.5 max-w-[46ch] font-mono text-xl leading-relaxed text-[#6D655B]">{texto}</p>
      {acao && <div className="mt-7 flex justify-center">{acao}</div>}
    </div>
  );
}

function DetalheIngresso({ ingresso, onVoltar }: { ingresso: IngressoResumo; onVoltar: () => void }) {
  return (
    <>
      <button
        type="button"
        onClick={onVoltar}
        className="mt-4 cursor-pointer font-mono text-[17px] tracking-wide text-[#6D655B] hover:text-flame-600"
      >
        ◀ VOLTAR PRA LISTA
      </button>

      <div className="mt-5">
        <CanhotoIngresso codigo={ingresso.codigo} codigoCurto={ingresso.codigoCurto}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="font-mono text-[19px] tracking-[2px] text-[#6D655B]">
              ROLO 35 · {ingresso.salaNome.toUpperCase()}
            </p>
            <SeloStatusIngresso status={ingresso.status} />
          </div>
          <h2 className="mt-1.5 font-display text-[clamp(20px,2.8cqw,28px)] leading-[1.05]">
            {ingresso.sessaoTitulo}
          </h2>
          <p className="mt-5 font-mono text-[17px] tracking-wide text-[#6D655B]">
            {rotuloDeDia(ingresso.dataHora)} · {rotuloDeHora(ingresso.dataHora)} · ASSENTO{' '}
            {assentoDe(ingresso)}
          </p>
          <p className="mt-5 font-mono text-base tracking-wide text-[#9C9488]">
            APRESENTE NA PORTARIA ATÉ 15 MIN ANTES
          </p>
          <AcoesDoIngresso codigo={ingresso.codigo} codigoCurto={ingresso.codigoCurto} className="mt-5" />
        </CanhotoIngresso>
      </div>
    </>
  );
}

export function MeusIngressosPage() {
  // A página vive na URL, como na vitrine: o cliente que compartilha o link ou volta pelo histórico
  // do navegador cai onde estava, e não na primeira página.
  const [parametros, setParametros] = useSearchParams();
  const pagina = Number(parametros.get('pagina') ?? '0');

  const [ingressos, setIngressos] = useState<IngressoResumo[]>([]);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [estado, setEstado] = useState<Estado>('loading');
  const [tentativa, setTentativa] = useState(0);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const { token } = useSessao();

  useEffect(() => {
    // Sem token não há requisição a fazer: a API responderia 401 e o convite seria o mesmo. Cortar
    // aqui também evita anunciar erro de servidor durante o tempo do 401 voltar.
    if (!token) {
      setEstado('sem-sessao');
      return;
    }
    let ativo = true;
    setEstado('loading');
    listarMeusIngressos({ pagina, tamanho: TAMANHO_PAGINA })
      .then((resultado) => {
        if (!ativo) {
          return;
        }
        setIngressos(resultado.conteudo);
        setTotalPaginas(resultado.totalPaginas);
        setAbertoId(null);
        setEstado(resultado.conteudo.length === 0 ? 'vazio' : 'pronto');
      })
      .catch((erro: unknown) => {
        if (ativo) {
          setEstado(erro instanceof SessaoExpiradaError ? 'expirada' : 'erro');
        }
      });
    return () => {
      ativo = false;
    };
    // `token` entra nas dependências pra carteira se recarregar sozinha quando o `apiFetch`
    // derruba a sessão numa outra aba — sem isso a tela ficaria mostrando ingressos de uma sessão
    // que já não vale.
  }, [tentativa, token, pagina]);

  function irPara(novaPagina: number) {
    const proximos = new URLSearchParams(parametros);
    proximos.set('pagina', String(novaPagina));
    setParametros(proximos);
  }

  const aberto = ingressos.find((ingresso) => ingresso.id === abertoId) ?? null;

  return (
    <PageShell>
      <div className="mx-auto max-w-[900px] px-5 pt-10 pb-[90px] sm:px-8 xl:max-w-[1040px]">
        <SectionTitle kicker="SUA CARTEIRA" rule={false}>
          MEUS INGRESSOS
        </SectionTitle>

        {estado === 'loading' && <p className="mt-8 font-mono text-lg text-ink-950/60">Carregando…</p>}
        {estado === 'erro' && (
          <p role="alert" className="mt-8 font-mono text-lg text-flame-600">
            Não foi possível carregar seus ingressos agora.
          </p>
        )}
        {estado === 'erro' && (
          <button
            type="button"
            onClick={() => setTentativa((atual) => atual + 1)}
            className={buttonClass('secondary', 'mt-4')}
          >
            TENTAR NOVAMENTE
          </button>
        )}

        {estado === 'sem-sessao' && (
          <PainelSemLista
            titulo="ENTRE PRA VER SEUS INGRESSOS"
            texto="Seus ingressos ficam guardados na sua conta, com QR code, assento e sala — prontos pra apresentar na portaria."
            acao={
              // Mesmo `retomarEm` da sessão expirada: o link do menu é aberto a visitante de
              // propósito, então quem chega por ele precisa cair de volta na carteira depois.
              <Link to="/login" state={{ retomarEm: '/meus-ingressos' }} className={buttonClass('primary')}>
                ENTRAR NA MINHA CONTA
              </Link>
            }
          />
        )}

        {estado === 'expirada' && (
          <PainelSemLista
            alerta
            titulo="SUA SESSÃO EXPIROU"
            texto="Faz um tempo que você entrou, e a gente encerra a sessão por segurança. Entre de novo pra abrir sua carteira."
            acao={
              // `retomarEm` traz de volta pra carteira depois do login, em vez de largar na vitrine
              // quem só queria ver o ingresso.
              <Link to="/login" state={{ retomarEm: '/meus-ingressos' }} className={buttonClass('primary')}>
                ENTRAR DE NOVO
              </Link>
            }
          />
        )}

        {estado === 'vazio' && (
          <PainelSemLista
            titulo="VOCÊ AINDA NÃO TEM INGRESSOS"
            texto="Escolha uma sessão, marque seus assentos e o ingresso aparece aqui na hora."
            acao={
              <Link to="/" className={buttonClass('primary')}>
                VER SESSÕES
              </Link>
            }
          />
        )}

        {estado === 'pronto' && aberto && (
          <DetalheIngresso ingresso={aberto} onVoltar={() => setAbertoId(null)} />
        )}

        {estado === 'pronto' && !aberto && (
          <>
            <ul className="mt-8 flex flex-col gap-5">
              {ingressos.map((ingresso) => (
                <LinhaIngresso key={ingresso.id} ingresso={ingresso} onAbrir={() => setAbertoId(ingresso.id)} />
              ))}
            </ul>
            {/* Fora do canhoto aberto: lá a lista não está na tela, e uma barra de páginas sem
                lista pra paginar só confunde. */}
            <Paginacao pagina={pagina} totalPaginas={totalPaginas} onIr={irPara} rotulo="ingressos" />
          </>
        )}
      </div>
    </PageShell>
  );
}
