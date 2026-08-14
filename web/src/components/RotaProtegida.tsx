import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import type { Papel } from '../api/auth';
import { rotaPorPapel } from '../pages/LoginPage';
import { useSessao } from '../lib/sessao';

interface RotaProtegidaProps {
  /** Papéis que podem ver a rota. Quem não estiver na lista é desviado, não recusado na tela. */
  papeis: Papel[];
  children: ReactNode;
}

/**
 * Guarda de rota por papel. É conveniência de navegação, não segurança: a barreira real continua
 * sendo o `@PreAuthorize` de cada endpoint, e um front adulterado não ganha nada burlando isto.
 * O que se ganha aqui é a tela não montar, disparar a chamada e só então anunciar um erro — quem
 * não podia estar ali chegava a ver a moldura da página antes de ser recusado pela API.
 */
export function RotaProtegida({ papeis, children }: RotaProtegidaProps) {
  const { token, papel } = useSessao();
  const { pathname, search } = useLocation();

  // `retomarEm` é a mesma convenção que o mapa de assentos e a carteira já usam pra voltar depois
  // do login; a query entra junto pra não perder filtro nem página de onde a pessoa veio.
  if (!token) {
    return <Navigate to="/login" replace state={{ retomarEm: `${pathname}${search}` }} />;
  }

  // Já logado com papel errado: mandar pro login pediria de novo a credencial que a pessoa acabou
  // de usar. O caminho útil é a casa do próprio papel.
  if (!papel || !papeis.includes(papel)) {
    return <Navigate to={papel ? rotaPorPapel(papel) : '/'} replace />;
  }

  return <>{children}</>;
}
