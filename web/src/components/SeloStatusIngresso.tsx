interface SeloStatusIngressoProps {
  status: 'VALIDO' | 'UTILIZADO';
}

/**
 * Selo de estado do ingresso. O handoff não desenhou esse selo — o protótipo não tinha o
 * conceito de ingresso já utilizado —, então ele reusa o vocabulário do canhoto (VT323, borda
 * de 2px) em vez de inventar forma nova: ciano pro que ainda vale, cinza morto pro que já passou.
 */
export function SeloStatusIngresso({ status }: SeloStatusIngressoProps) {
  return (
    <span
      className={`flex-none border-2 px-2.5 py-0.5 font-mono text-sm tracking-wide ${
        status === 'VALIDO' ? 'border-cyan-400 text-cyan-400' : 'border-[#7E7686] text-[#7E7686]'
      }`}
    >
      {status}
    </span>
  );
}
