import type { ReservaCheckout } from '../api/reservas';
import { formatarPreco, rotuloDeDia, rotuloDeHora } from '../lib/sessoes';

interface ResumoDaReservaProps {
  reserva: ReservaCheckout | null;
  total: number;
}

export function ResumoDaReserva({ reserva, total }: ResumoDaReservaProps) {
  const assentos = reserva?.assentos ?? [];

  return (
    <aside className="flex-[1_1_280px] border-[3px] border-ink-950 bg-paper-50 p-6 shadow-[9px_9px_0_var(--color-ink-950)] xl:p-8">
      <p className="font-mono text-[19px] tracking-[2px] text-[#6D655B]">SUA RESERVA</p>
      <h2 className="mt-2 font-display text-xl leading-[1.1]">{reserva?.sessaoTitulo}</h2>
      <div className="my-4 h-[3px] bg-gradient-to-r from-flame-600 to-flame-400" />

      <div className="grid gap-3.5 text-[13px]">
        <div>
          <p className="font-mono text-[17px] tracking-wide text-[#6D655B]">SESSÃO</p>
          <p className="mt-0.5 font-bold">
            {rotuloDeDia(reserva?.dataHora ?? '')} · {rotuloDeHora(reserva?.dataHora ?? '')}
          </p>
        </div>
        <div>
          <p className="font-mono text-[17px] tracking-wide text-[#6D655B]">SALA</p>
          <p className="mt-0.5 font-bold">{(reserva?.salaNome ?? '').toUpperCase()}</p>
        </div>
      </div>

      <p className="mt-[18px] font-mono text-[17px] tracking-wide text-[#6D655B]">ASSENTOS · 1 INGRESSO CADA</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {assentos.map((assento) => (
          <span
            key={assento.id}
            className="border-2 border-ink-950 bg-gradient-to-r from-flame-400 to-[#F7A81B] px-2.5 py-[5px] font-display text-[13px]"
          >
            {assento.fileira}
            {assento.numero}
          </span>
        ))}
      </div>

      <div className="mt-5 flex items-baseline justify-between border-t-2 border-dashed border-[#C7B694] pt-4">
        <span className="font-mono text-xl tracking-wide text-[#6D655B]">TOTAL</span>
        <span className="font-display text-[28px] text-flame-600">{formatarPreco(total)}</span>
      </div>
    </aside>
  );
}
