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
  let digitos = somenteDigitos(valor, DIGITOS_DA_VALIDADE);
  // Um primeiro dígito acima de 1 não começa mês nenhum: quem digitou 9 quis dizer setembro.
  // Completar aqui evita deixar "90/78" ser digitado inteiro só pra ser recusado no fim.
  if (/^[2-9]/.test(digitos)) {
    digitos = `0${digitos}`.slice(0, DIGITOS_DA_VALIDADE);
  }
  return digitos.length > 2 ? `${digitos.slice(0, 2)}/${digitos.slice(2)}` : digitos;
}

export function formatarCvv(valor: string): string {
  return somenteDigitos(valor, MAX_DIGITOS_CVV);
}

export function formatarNomeNoCartao(valor: string): string {
  return valor.replace(/\d/g, '');
}

/**
 * Devolve o que impede este cartão de ser usado, ou `null` se não houver nada. Uma mensagem por
 * problema, e não um booleano só: com o formulário inteiro preenchido e um mês inexistente, pedir
 * pra "preencher todos os dados" manda a pessoa procurar um campo vazio que não existe.
 */
export function problemaNoCartao(
  { nome, numero, validade, cvv }: DadosDoCartao,
  hoje: Date = new Date(),
): string | null {
  if (nome.trim() === '' || numero === '' || validade === '' || cvv === '') {
    return 'Preencha todos os dados do cartão pra continuar.';
  }
  if (numero.replace(/\D/g, '').length !== DIGITOS_DO_NUMERO) {
    return 'Número do cartão incompleto — são 16 dígitos.';
  }

  const [mes, ano] = validade.split('/');
  const mesValido = /^\d{2}$/.test(mes ?? '') && Number(mes) >= 1 && Number(mes) <= 12;
  if (!mesValido || !/^\d{2}$/.test(ano ?? '')) {
    return 'Validade inválida — use MM/AA, com mês de 01 a 12.';
  }
  // O ano de dois dígitos é sempre deste século: cartão de 19xx não circula mais.
  const ultimoDiaDoMes = new Date(2000 + Number(ano), Number(mes), 0, 23, 59, 59);
  if (ultimoDiaDoMes < hoje) {
    return 'Cartão vencido — confira a validade.';
  }
  if (cvv.length < MIN_DIGITOS_CVV) {
    return 'CVV incompleto — são 3 ou 4 dígitos.';
  }
  return null;
}
