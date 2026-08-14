import type { ResultadoValidacao } from '../api/portaria';

// O vermelho da marca (`flame-600`, #E32B21) sobre o fundo escuro do veredito fica em ~3.4:1:
// passa no título de 30px, não passa no rótulo em VT323. Este é o mesmo tom clareado o
// suficiente pra servir aos dois — é o único desvio de cor em relação ao protótipo.
const VERMELHO_TERMINAL = '#ff5347';

/** Par borda//fundo de cada veredito, nos valores do protótipo. */
const VEREDITO: Record<ResultadoValidacao['resultado'], { cor: string; fundo: string }> = {
  VALIDO: { cor: '#8fe04a', fundo: '#12200e' },
  JA_UTILIZADO: { cor: '#ffc414', fundo: '#241c08' },
  INVALIDO: { cor: VERMELHO_TERMINAL, fundo: '#240c0c' },
  EVENTO_ERRADO: { cor: VERMELHO_TERMINAL, fundo: '#240c0c' },
};

const ROTULOS: Record<ResultadoValidacao['resultado'], string> = {
  VALIDO: 'VÁLIDO — LIBERAR ENTRADA',
  INVALIDO: 'INVÁLIDO',
  JA_UTILIZADO: 'JÁ UTILIZADO',
  EVENTO_ERRADO: 'EVENTO ERRADO',
};

export function VereditoDaLeitura({ resultado }: { resultado: ResultadoValidacao }) {
  const { cor, fundo } = VEREDITO[resultado.resultado];

  return (
    <div className="mt-6 border-[3px] p-6" style={{ borderColor: cor, backgroundColor: fundo }}>
      <p className="font-mono text-lg tracking-[2px]" style={{ color: cor }}>
        ÚLTIMA LEITURA
      </p>
      <p className="mt-2 font-display text-[clamp(20px,3.4cqw,30px)] leading-tight" style={{ color: cor }}>
        {ROTULOS[resultado.resultado]}
      </p>

      <div className="mt-[18px] grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3.5 font-mono text-lg text-paper-100/70">
        {resultado.assentoFileira && resultado.assentoNumero && (
          <p>
            Assento{' '}
            <span className="block text-white">
              {resultado.assentoFileira}
              {resultado.assentoNumero}
            </span>
          </p>
        )}
        {/* Rotulado de propósito: o título aqui é o da sessão do *turno*, não a do ingresso.
            Sem o rótulo, o operador lê "EVENTO ERRADO / Clube da Luta" segurando um ingresso
            de outro filme e conclui o oposto do que a resposta quis dizer. */}
        {resultado.sessaoTitulo && (
          <p>
            Sessão do turno: <span className="block text-white">{resultado.sessaoTitulo}</span>
          </p>
        )}
      </div>
    </div>
  );
}
