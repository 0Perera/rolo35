import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router';

/**
 * Leva a página pro topo quando a rota muda. Sem isso a tela nova abre na mesma
 * altura de rolagem da anterior — clicar num pôster no fim da vitrine caía no rodapé
 * do detalhe do filme.
 *
 * O "voltar" do navegador (POP) fica de fora: ali a posição anterior é o comportamento
 * esperado, e é o próprio navegador que a restaura.
 */
export function RolarAoTrocarDeRota() {
  const { pathname } = useLocation();
  const tipoDeNavegacao = useNavigationType();

  useEffect(() => {
    if (tipoDeNavegacao !== 'POP') {
      window.scrollTo(0, 0);
    }
  }, [pathname, tipoDeNavegacao]);

  return null;
}
