import { useEffect, type RefObject } from 'react';

/** Fecha um painel flutuante quando o clique cai fora dele. */
export function useFecharAoClicarFora(
  referencia: RefObject<HTMLElement | null>,
  aberto: boolean,
  fechar: () => void,
): void {
  useEffect(() => {
    if (!aberto) {
      return;
    }
    function aoClicarFora(evento: MouseEvent) {
      if (!referencia.current?.contains(evento.target as Node)) {
        fechar();
      }
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [referencia, aberto, fechar]);
}
