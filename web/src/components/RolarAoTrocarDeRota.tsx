import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router';

/**
 * Leva a página pro topo quando a rota muda. Sem isso a tela nova abre na mesma
 * altura de rolagem da anterior — clicar num pôster no fim da vitrine caía no rodapé
 * do detalhe do filme.
 *
 * O "voltar" do navegador (POP) fica de fora: ali a posição anterior é o comportamento
 * esperado, e é o próprio navegador que a restaura.
 *
 * Só o caminho conta, nunca a query string. Busca, filtro e paginação vivem na URL: sem essa
 * distinção, escolher uma sala no meio da vitrine jogava o visitante de volta pro topo da página,
 * longe da grade que ele estava lendo. Trocar de filtro não é trocar de tela.
 */
export function RolarAoTrocarDeRota() {
  const { pathname } = useLocation();
  const tipoDeNavegacao = useNavigationType();
  const caminhoAnterior = useRef<string | null>(null);

  useEffect(() => {
    const mudouDeTela = caminhoAnterior.current !== null && caminhoAnterior.current !== pathname;
    caminhoAnterior.current = pathname;
    if (mudouDeTela && tipoDeNavegacao !== 'POP') {
      window.scrollTo(0, 0);
    }
  }, [pathname, tipoDeNavegacao]);

  return null;
}
