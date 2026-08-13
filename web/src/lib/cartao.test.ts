import { describe, expect, it } from 'vitest';
import {
  formatarCvv,
  formatarNomeNoCartao,
  formatarNumeroCartao,
  formatarValidade,
  problemaNoCartao,
} from './cartao';

describe('formatarNumeroCartao', () => {
  it('drops anything that is not a digit', () => {
    expect(formatarNumeroCartao('4a1b1c1')).toBe('4111');
  });

  it('groups the digits in blocks of four', () => {
    expect(formatarNumeroCartao('4111111111111111')).toBe('4111 1111 1111 1111');
  });

  it('does not leave a trailing space while a block is still open', () => {
    expect(formatarNumeroCartao('4111')).toBe('4111');
    expect(formatarNumeroCartao('41111')).toBe('4111 1');
  });

  it('stops at sixteen digits', () => {
    expect(formatarNumeroCartao('41111111111111119999')).toBe('4111 1111 1111 1111');
  });
});

describe('formatarValidade', () => {
  it('puts the slash in by itself', () => {
    expect(formatarValidade('1230')).toBe('12/30');
  });

  it('does not add the slash before the month is complete', () => {
    expect(formatarValidade('1')).toBe('1');
    expect(formatarValidade('12')).toBe('12');
  });

  it('drops letters and stops at four digits', () => {
    expect(formatarValidade('1a2/b3c0d9')).toBe('12/30');
  });

  it('keeps deleting the slash from working', () => {
    expect(formatarValidade('12/')).toBe('12');
  });

  // Não existe mês 9x. Prefixar com zero é o que todo formulário de cartão faz: quem digita "9"
  // quis dizer setembro, e deixar "90/78" ser digitado só pra recusar depois é ruído.
  it('completes a single-digit month that could not start a valid one', () => {
    expect(formatarValidade('9')).toBe('09');
    expect(formatarValidade('90')).toBe('09/0');
    expect(formatarValidade('1')).toBe('1');
    expect(formatarValidade('0')).toBe('0');
  });
});

describe('formatarCvv', () => {
  it('takes digits only, up to four', () => {
    expect(formatarCvv('1a2b3')).toBe('123');
    expect(formatarCvv('12345')).toBe('1234');
  });
});

describe('formatarNomeNoCartao', () => {
  it('drops digits — no card prints a number in the holder name', () => {
    expect(formatarNomeNoCartao('Ana 3 Paula')).toBe('Ana  Paula');
  });
});

describe('problemaNoCartao', () => {
  const valido = { nome: 'Ana Paula', numero: '4111 1111 1111 1111', validade: '12/30', cvv: '123' };
  const hoje = new Date(2026, 7, 12);

  it('finds nothing wrong with a fully filled card', () => {
    expect(problemaNoCartao(valido, hoje)).toBeNull();
  });

  it('asks to fill the form only when something is actually empty', () => {
    expect(problemaNoCartao({ ...valido, nome: '   ' }, hoje)).toMatch(/preencha/i);
    expect(problemaNoCartao({ ...valido, cvv: '' }, hoje)).toMatch(/preencha/i);
  });

  // O caso que motivou a distinção: tudo preenchido, mas o mês não existe. Pedir pra "preencher
  // todos os dados" com o formulário cheio manda a pessoa procurar o campo vazio que não existe.
  it('points at the field that is wrong when everything is filled', () => {
    expect(problemaNoCartao({ ...valido, validade: '13/30' }, hoje)).toMatch(/validade/i);
    expect(problemaNoCartao({ ...valido, validade: '00/30' }, hoje)).toMatch(/validade/i);
    expect(problemaNoCartao({ ...valido, numero: '4111 1111' }, hoje)).toMatch(/número/i);
    expect(problemaNoCartao({ ...valido, cvv: '12' }, hoje)).toMatch(/cvv/i);
  });

  it('rejects an incomplete expiry date', () => {
    expect(problemaNoCartao({ ...valido, validade: '12/3' }, hoje)).toMatch(/validade/i);
  });

  it('rejects a card that already expired', () => {
    expect(problemaNoCartao({ ...valido, validade: '07/26' }, hoje)).toMatch(/venc/i);
    expect(problemaNoCartao({ ...valido, validade: '08/26' }, hoje)).toBeNull();
  });
});
