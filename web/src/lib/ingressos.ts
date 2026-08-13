/**
 * Link público do ingresso — é o que o botão de compartilhar copia e o que o QR carrega.
 * Mora no `lib` porque a carteira e a página pública precisam gerar exatamente a mesma URL:
 * se as duas divergirem, o QR de uma leva pra um lugar diferente do link da outra.
 */
export function urlPublicaDoIngresso(codigo: string): string {
  return `${window.location.origin}/ingressos/${codigo}`;
}
