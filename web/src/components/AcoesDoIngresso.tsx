import { buttonClass } from './Button';
import { useCopiar } from '../lib/copiar';
import { urlPublicaDoIngresso } from '../lib/ingressos';

interface AcoesDoIngressoProps {
  /** Token assinado do link público. Só o botão de compartilhar usa — não vai pro clipboard. */
  codigo: string;
  /** Credencial ditável: é o que o botão copiar entrega e o que a portaria aceita digitado. */
  codigoCurto: string;
  className?: string;
}

const ROTULOS_LINK = {
  ocioso: '↗ COMPARTILHAR',
  copiado: 'LINK COPIADO ✓',
  falhou: 'NÃO FOI POSSÍVEL COPIAR',
} as const;

const ROTULOS_CODIGO = {
  ocioso: '⧉ COPIAR CÓDIGO',
  copiado: 'CÓDIGO COPIADO ✓',
  falhou: 'NÃO FOI POSSÍVEL COPIAR',
} as const;

/**
 * O rodapé de ações do canhoto: compartilhar o link público e copiar o código do ingresso.
 *
 * <p>São duas coisas diferentes e trocar uma pela outra quebra o fluxo — link colado no campo da
 * portaria não valida, e código colado no WhatsApp não abre página nenhuma. Daí os dois botões
 * conviverem, com o compartilhar em destaque (é a ação frequente) e o copiar código em segundo
 * plano (é contingência pra quando a câmera da portaria falha).
 *
 * <p>Copiar entrega o código curto, não o assinado: é o curto que está impresso no canhoto e o
 * que a portaria aceita digitado. Com 8 caracteres dá pra transcrever à mão — só que quem
 * transcreve troca um caractere, e o outro lado chega na porta com um ingresso que não existe. O
 * alfabeto já evita I, L, O e U por isso; o botão fecha o resto do buraco.
 */
export function AcoesDoIngresso({ codigo, codigoCurto, className = '' }: AcoesDoIngressoProps) {
  const link = useCopiar();
  const codigoCopia = useCopiar();

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <button
        type="button"
        onClick={() => link.copiar(urlPublicaDoIngresso(codigo))}
        className={buttonClass('ticket')}
      >
        {ROTULOS_LINK[link.estado]}
      </button>

      <button
        type="button"
        onClick={() => codigoCopia.copiar(codigoCurto)}
        className={buttonClass('ticket', 'bg-none bg-paper-50 text-ink-950 hover:bg-paper-100 hover:text-ink-950')}
      >
        {ROTULOS_CODIGO[codigoCopia.estado]}
      </button>

      {/* A confirmação é só uma troca de texto dentro do botão; sem `aria-live`, quem usa leitor
          de tela clica e não recebe retorno nenhum de que a cópia aconteceu. */}
      <span aria-live="polite" className="sr-only">
        {link.estado === 'copiado' ? 'Link copiado' : ''}
        {codigoCopia.estado === 'copiado' ? 'Código copiado' : ''}
        {link.estado === 'falhou' || codigoCopia.estado === 'falhou' ? 'Não foi possível copiar' : ''}
      </span>
    </div>
  );
}
