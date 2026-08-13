/**
 * Máscara e validação dos campos de cartão do checkout simulado. Vive aqui, e não na página, por
 * ser função pura de string — e porque a regra de "está preenchido o bastante pra confirmar" é o
 * que a AC7 exige antes de qualquer requisição.
 *
 * Nada disto valida cartão de verdade (não há algoritmo de Luhn, nem checagem de bandeira): o
 * pagamento é simulado e o número nunca sai da tela. O que se valida é forma, pra que o campo se
 * comporte como o cliente espera de um formulário de pagamento.
 */

export interface DadosDoCartao {
  nome: string;
  numero: string;
  validade: string;
  cvv: string;
}

const DIGITOS_DO_NUMERO = 16;
const DIGITOS_DA_VALIDADE = 4;
const MAX_DIGITOS_CVV = 4;
const MIN_DIGITOS_CVV = 3;

function somenteDigitos(valor: string, limite: number): string {
  return valor.replace(/\D/g, '').slice(0, limite);
}

export function formatarNumeroCartao(valor: string): string {
  const digitos = somenteDigitos(valor, DIGITOS_DO_NUMERO);
  // Sem espaço à direita enquanto o bloco está aberto: com ele, apagar o último dígito devolveria
  // o cursor pra depois de um espaço e a tecla seguinte pareceria não ter efeito.
  return digitos.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function formatarValidade(valor: string): string {
  const digitos = somenteDigitos(valor, DIGITOS_DA_VALIDADE);
  return digitos.length > 2 ? `${digitos.slice(0, 2)}/${digitos.slice(2)}` : digitos;
}

export function formatarCvv(valor: string): string {
  return somenteDigitos(valor, MAX_DIGITOS_CVV);
}

export function formatarNomeNoCartao(valor: string): string {
  return valor.replace(/\d/g, '');
}

export function cartaoCompleto({ nome, numero, validade, cvv }: DadosDoCartao): boolean {
  const digitosDoNumero = numero.replace(/\D/g, '');
  const [mes, ano] = validade.split('/');
  const mesValido = /^\d{2}$/.test(mes ?? '') && Number(mes) >= 1 && Number(mes) <= 12;

  return (
    nome.trim() !== '' &&
    digitosDoNumero.length === DIGITOS_DO_NUMERO &&
    mesValido &&
    /^\d{2}$/.test(ano ?? '') &&
    cvv.length >= MIN_DIGITOS_CVV
  );
}
