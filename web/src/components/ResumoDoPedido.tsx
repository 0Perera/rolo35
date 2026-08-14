import type { AssentoMapa, MapaAssentos } from '../api/sessoes';
import { Alert } from './Alert';
import { Button } from './Button';
import { formatarPreco, rotuloDeDia, rotuloDeHora } from '../lib/sessoes';

interface ResumoDoPedidoProps {
  mapa: MapaAssentos;
  assentosSelecionados: AssentoMapa[];
  maximoDeAssentos: number;
  avisoLimite: boolean;
  mensagemErro: string;
  reservando: boolean;
  onReservar: () => void;
}

/** Resumo do pedido: acompanha a seleção sem exigir rolagem de volta pro topo. */
export function ResumoDoPedido({
  mapa,
  assentosSelecionados,
  maximoDeAssentos,
  avisoLimite,
  mensagemErro,
  reservando,
  onReservar,
}: ResumoDoPedidoProps) {
  return (
    <aside className="flex-[1_1_290px] border-[3px] border-ink-950 bg-paper-50 p-6 shadow-[9px_9px_0_var(--color-ink-950)] xl:p-8">
      <p className="font-mono text-lg tracking-[2px] text-[#6D655B]">SEU PEDIDO</p>
      <h1 className="mt-2 font-display text-[22px] leading-[1.1]">{mapa.titulo}</h1>

      <div className="my-4 h-[3px] bg-gradient-to-r from-flame-600 to-flame-400" />

      <div className="grid grid-cols-2 gap-3.5 text-[13px]">
        <div>
          <div className="font-mono text-[17px] tracking-wide text-[#6D655B]">SESSÃO</div>
          <div className="mt-0.5 font-bold">
            {rotuloDeDia(mapa.dataHora)} · {rotuloDeHora(mapa.dataHora)}
          </div>
        </div>
        <div>
          <div className="font-mono text-[17px] tracking-wide text-[#6D655B]">SALA</div>
          <div className="mt-0.5 font-bold">{mapa.salaNome.toUpperCase()}</div>
        </div>
      </div>

      <p className="mt-5 font-mono text-[17px] tracking-wide text-[#6D655B]">
        ASSENTOS <span className="text-[#9C9488]">(máx. {maximoDeAssentos} · {formatarPreco(mapa.preco)} cada)</span>
      </p>
      <div className="mt-2 flex min-h-[44px] flex-wrap gap-2">
        {assentosSelecionados.map((assento) => (
          <span
            key={assento.id}
            className="border-2 border-ink-950 bg-gradient-to-r from-flame-400 to-[#F7A81B] px-2.5 py-[5px] font-display text-[13px]"
          >
            {assento.fileira}
            {assento.numero}
          </span>
        ))}
        {assentosSelecionados.length === 0 && (
          <span className="font-mono text-lg text-[#B5A990]">nenhum assento escolhido</span>
        )}
      </div>

      {avisoLimite && (
        <p role="alert" className="mt-1.5 font-mono text-[15px] text-flame-600">
          Máximo de {maximoDeAssentos} assentos por reserva.
        </p>
      )}

      <div className="mt-5 flex items-baseline justify-between border-t-2 border-dashed border-[#C7B694] pt-4">
        <span className="font-mono text-xl tracking-wide text-[#6D655B]">TOTAL</span>
        <span className="font-display text-[30px] text-flame-600">
          {formatarPreco(mapa.preco * assentosSelecionados.length)}
        </span>
      </div>

      {mensagemErro && (
        <div className="mt-4">
          <Alert>{mensagemErro}</Alert>
        </div>
      )}

      <Button
        type="button"
        className="mt-[18px] w-full py-[15px] text-base"
        disabled={assentosSelecionados.length === 0 || reservando}
        onClick={onReservar}
      >
        {reservando ? 'RESERVANDO…' : 'IR PARA O PAGAMENTO'}
      </Button>
      <p className="mt-3 text-center font-mono text-base tracking-wide text-[#6D655B]">
        SEUS ASSENTOS FICAM RESERVADOS POR 10 MIN
      </p>
    </aside>
  );
}
