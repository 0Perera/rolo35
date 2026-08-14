import type { IngressoEmitido } from '../api/pagamentos';
import type { ReservaCheckout } from '../api/reservas';
import { formatarPreco, rotuloDeDia, rotuloDeHora } from '../lib/sessoes';
import { AcoesDoIngresso } from './AcoesDoIngresso';
import { CanhotoIngresso } from './CanhotoIngresso';

interface CanhotoEmitidoProps {
  ingresso: IngressoEmitido;
  reserva: ReservaCheckout;
  rotuloAssento: string;
}

/** Canhoto recém-emitido, com os dados da reserva que acabou de virar ingresso. */
export function CanhotoEmitido({ ingresso, reserva, rotuloAssento }: CanhotoEmitidoProps) {
  return (
    <CanhotoIngresso codigo={ingresso.codigo} codigoCurto={ingresso.codigoCurto}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[19px] tracking-[2px] text-[#6D655B]">
            ROLO 35 · {(reserva.salaNome ?? '').toUpperCase()}
          </p>
          <h2 className="mt-1.5 font-display text-[clamp(20px,2.8cqw,28px)] leading-[1.05]">{reserva.sessaoTitulo}</h2>
        </div>
        <span className="shrink-0 border-[3px] border-navy-700 px-3.5 py-1.5 font-display text-xl text-navy-700">
          {rotuloAssento}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-[18px] border-t-2 border-dashed border-[#C7B694] pt-[18px]">
        <div>
          <p className="font-mono text-[17px] tracking-wide text-[#6D655B]">DATA</p>
          <p className="mt-1 font-display text-base">{rotuloDeDia(reserva.dataHora ?? '')}</p>
        </div>
        <div>
          <p className="font-mono text-[17px] tracking-wide text-[#6D655B]">HORA</p>
          <p className="mt-1 font-display text-base">{rotuloDeHora(reserva.dataHora ?? '')}</p>
        </div>
        <div>
          <p className="font-mono text-[17px] tracking-wide text-[#6D655B]">ASSENTO</p>
          <p className="mt-1 font-display text-base">{rotuloAssento}</p>
        </div>
        <div>
          <p className="font-mono text-[17px] tracking-wide text-[#6D655B]">VALOR</p>
          <p className="mt-1 font-display text-base text-flame-600">{formatarPreco(reserva.preco ?? 0)}</p>
        </div>
      </div>

      {/* break-all: o código é `uuid.assinatura`, uma palavra só e longa o bastante pra
          estourar o canhoto no mobile. */}
      <p className="mt-5 font-mono text-[17px] tracking-wide break-all text-[#6D655B]">CÓDIGO {ingresso.codigo}</p>
      <p className="mt-1 font-mono text-base tracking-wide text-[#9C9488]">
        ASSINADO · APRESENTE NA PORTARIA ATÉ 15 MIN ANTES
      </p>
      {/* É aqui que compartilhar faz mais falta: o cliente acabou de receber os ingressos e
          manda o do acompanhante antes de sair da tela. */}
      <AcoesDoIngresso codigo={ingresso.codigo} className="mt-5" />
    </CanhotoIngresso>
  );
}
