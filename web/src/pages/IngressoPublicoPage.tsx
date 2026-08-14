import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { buscarIngressoPublico, type IngressoPublico } from '../api/ingressos';
import { ApiRequestError } from '../api/client';
import { AcoesDoIngresso } from '../components/AcoesDoIngresso';
import { CanhotoIngresso } from '../components/CanhotoIngresso';
import { PageShell } from '../components/PageShell';
import { SectionTitle } from '../components/SectionTitle';
import { SeloStatusIngresso } from '../components/SeloStatusIngresso';
import { rotuloDeDia, rotuloDeHora } from '../lib/sessoes';

type Estado = 'loading' | 'nao-encontrado' | 'erro' | 'pronto';

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div className="font-mono text-[17px] tracking-wide text-[#6D655B]">{rotulo}</div>
      <div className="mt-1 font-display text-base">{valor}</div>
    </div>
  );
}

export function IngressoPublicoPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [ingresso, setIngresso] = useState<IngressoPublico | null>(null);
  const [estado, setEstado] = useState<Estado>('loading');

  useEffect(() => {
    let ativo = true;
    if (!codigo) {
      setEstado('nao-encontrado');
      return;
    }
    setEstado('loading');
    buscarIngressoPublico(codigo)
      .then((resultado) => {
        if (!ativo) {
          return;
        }
        setIngresso(resultado);
        setEstado('pronto');
      })
      .catch((error: unknown) => {
        if (!ativo) {
          return;
        }
        setEstado(error instanceof ApiRequestError && error.status === 404 ? 'nao-encontrado' : 'erro');
      });
    return () => {
      ativo = false;
    };
  }, [codigo]);

  return (
    <PageShell>
      <div className="mx-auto max-w-[900px] px-5 pt-10 pb-[90px] sm:px-8 xl:max-w-[1040px]">
        <SectionTitle kicker="INGRESSO" rule={false}>
          ROLO 35
        </SectionTitle>

        {estado === 'loading' && <p className="mt-8 font-mono text-lg text-ink-950/60">Carregando…</p>}
        {estado === 'nao-encontrado' && (
          <p role="alert" className="mt-8 font-mono text-lg text-flame-600">
            Ingresso não encontrado.
          </p>
        )}
        {estado === 'erro' && (
          <p role="alert" className="mt-8 font-mono text-lg text-flame-600">
            Não foi possível carregar este ingresso agora.
          </p>
        )}

        {estado === 'pronto' && ingresso && codigo && (
          <div className="mt-8">
            {/* Página pública: só leitura. Nada de compartilhar aqui — quem abriu o link já está
                nele, e o canhoto não pode oferecer ação de dono pra quem não é dono. */}
            <CanhotoIngresso codigo={codigo}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-mono text-[19px] tracking-[2px] text-[#6D655B]">
                  ROLO 35 · {ingresso.salaNome.toUpperCase()}
                </p>
                <SeloStatusIngresso status={ingresso.status} />
              </div>
              <h2 className="mt-1.5 font-display text-[clamp(20px,2.8cqw,28px)] leading-[1.05]">
                {ingresso.sessaoTitulo}
              </h2>

              <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-[18px] border-t-2 border-dashed border-[#C7B694] pt-[18px]">
                <Dado rotulo="DATA" valor={rotuloDeDia(ingresso.dataHora)} />
                <Dado rotulo="HORA" valor={rotuloDeHora(ingresso.dataHora)} />
              </div>

              {/* break-all porque o código é `uuid.assinatura` — uma palavra só, longa o bastante
                  pra estourar o canhoto no mobile se ficar inquebrável. */}
              <p className="mt-5 font-mono text-[17px] tracking-wide break-all text-[#6D655B]">CÓDIGO {codigo}</p>
              <p className="mt-1 font-mono text-base tracking-wide text-[#9C9488]">
                ASSINADO · APRESENTE NA PORTARIA ATÉ 15 MIN ANTES
              </p>
              <AcoesDoIngresso codigo={codigo} className="mt-5" />
            </CanhotoIngresso>
          </div>
        )}
      </div>
    </PageShell>
  );
}
