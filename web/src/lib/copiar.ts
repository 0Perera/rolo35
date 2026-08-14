import { useRef, useState } from 'react';

export type EstadoCopia = 'ocioso' | 'copiado' | 'falhou';

const TEMPO_DE_RETORNO_MS = 2000;

/**
 * `navigator.clipboard` só existe em contexto seguro (HTTPS ou localhost). O caso que mais importa
 * aqui é justamente o inseguro: cliente abrindo o ingresso pelo celular num endereço `http://` da
 * rede local. Por isso o fallback com `execCommand` — obsoleto, mas é o que ainda funciona fora de
 * contexto seguro, e sem ele o botão não faz nada e o usuário não sabe por quê.
 */
async function escreverNaAreaDeTransferencia(texto: string): Promise<boolean> {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch {
      // Cai no fallback abaixo: permissão negada também chega aqui, não só contexto inseguro.
    }
  }

  const campo = document.createElement('textarea');
  campo.value = texto;
  // Fora da tela, mas não `display: none` nem `hidden`: campo não renderizado não é selecionável,
  // e sem seleção o `execCommand('copy')` copia string vazia.
  campo.setAttribute('readonly', '');
  campo.style.position = 'fixed';
  campo.style.top = '-9999px';
  document.body.appendChild(campo);
  try {
    campo.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(campo);
  }
}

/**
 * Copiar texto com retorno visível e temporário.
 *
 * <p>O estado precisa voltar sozinho pra `ocioso`: um "COPIADO ✓" permanente deixa de ser
 * confirmação da última ação e vira rótulo do botão.
 */
export function useCopiar() {
  const [estado, setEstado] = useState<EstadoCopia>('ocioso');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copiar(texto: string) {
    const deuCerto = await escreverNaAreaDeTransferencia(texto);
    setEstado(deuCerto ? 'copiado' : 'falhou');
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => setEstado('ocioso'), TEMPO_DE_RETORNO_MS);
  }

  return { estado, copiar };
}
