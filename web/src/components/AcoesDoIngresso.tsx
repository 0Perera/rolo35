import { buttonClass } from './Button';
import { useCopiar } from '../lib/copiar';
import { urlPublicaDoIngresso } from '../lib/ingressos';

interface AcoesDoIngressoProps {
  codigo: string;
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
 * O rodapé de ações do canhoto: compartilhar o link público e copiar o código assinado.
 *
 * <p>São duas coisas diferentes e trocar uma pela outra quebra o fluxo — link colado no campo da
 * portaria não valida, e código colado no WhatsApp não abre página nenhuma. Daí os dois botões
 * conviverem, com o compartilhar em destaque (é a ação frequente) e o copiar código em segundo
 * plano (é contingência pra quando a câmera da portaria falha).
 *
 * <p>Copiar código existe porque selecionar `uuid.assinatura` com o dedo é inviável: uma palavra
 * só, longa, quebrada em várias linhas. No desktop dá pra arrastar o mouse; no celular, não — e é
 * no celular que o cliente abre o ingresso.
 */
export function AcoesDoIngresso({ codigo, className = '' }: AcoesDoIngressoProps) {
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
        onClick={() => codigoCopia.copiar(codigo)}
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
