import type { RefObject } from 'react';
import type { ResultadoValidacao } from '../api/portaria';

/** Legenda dentro do visor, no lugar da imagem da câmera. */
const STATUS_SCANNER: Record<ResultadoValidacao['resultado'], string> = {
  VALIDO: 'LIDO COM SUCESSO',
  INVALIDO: 'QR NÃO RECONHECIDO',
  JA_UTILIZADO: 'TICKET REPETIDO',
  EVENTO_ERRADO: 'OUTRA SESSÃO',
};

const VISOR_FUNDO = { backgroundImage: 'radial-gradient(circle at 50% 45%, #16222b 0%, #06080c 75%)' };

const VISOR_SCANLINES = {
  backgroundImage:
    'repeating-linear-gradient(0deg, rgba(126,217,242,0.18) 0px, rgba(126,217,242,0.18) 1px, transparent 1px, transparent 4px)',
};

const CANTOS = [
  'top-[14%] left-[14%] border-t-[5px] border-l-[5px]',
  'top-[14%] right-[14%] border-t-[5px] border-r-[5px]',
  'bottom-[14%] left-[14%] border-b-[5px] border-l-[5px]',
  'bottom-[14%] right-[14%] border-b-[5px] border-r-[5px]',
];

interface VisorDoScannerProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  cameraLigada: boolean;
  validando: boolean;
  resultado: ResultadoValidacao | null;
  erroCamera: string | null;
  onAlternarCamera: () => void;
}

export function VisorDoScanner({
  videoRef,
  cameraLigada,
  validando,
  resultado,
  erroCamera,
  onAlternarCamera,
}: VisorDoScannerProps) {
  const status = validando ? 'LENDO…' : resultado ? STATUS_SCANNER[resultado.resultado] : 'APROXIME O QR CODE';

  return (
    <section className="border-[3px] border-cyan-400 bg-[#06080c] p-[22px]">
      <div className="relative aspect-square overflow-hidden" style={VISOR_FUNDO}>
        <video ref={videoRef} className={cameraLigada ? 'absolute inset-0 h-full w-full object-cover' : 'hidden'} />
        <div aria-hidden className="pointer-events-none absolute inset-0" style={VISOR_SCANLINES} />
        <div
          aria-hidden
          className="pointer-events-none absolute right-[14%] left-[14%] h-[3px] bg-flame-600 shadow-[0_0_14px_var(--color-flame-600)] motion-safe:animate-[rolo-scan_3.2s_linear_infinite]"
        />
        {CANTOS.map((canto) => (
          <div key={canto} aria-hidden className={`pointer-events-none absolute h-[54px] w-[54px] border-flame-400 ${canto}`} />
        ))}
        {!cameraLigada && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center font-mono text-[22px] tracking-[2px] text-cyan-400">
            {status}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onAlternarCamera}
        className="mt-5 w-full border-[3px] border-flame-400 bg-gradient-to-r from-flame-600 via-flame-500 to-flame-400 p-4 font-display text-base text-ink-950 hover:brightness-110"
      >
        {cameraLigada ? 'DESLIGAR CÂMERA' : 'LIGAR CÂMERA'}
      </button>

      {erroCamera && (
        <p role="alert" className="mt-3 font-mono text-lg text-flame-400">
          {erroCamera}
        </p>
      )}
    </section>
  );
}
