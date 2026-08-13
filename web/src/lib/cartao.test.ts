import { describe, expect, it } from 'vitest';
import { cartaoCompleto, formatarCvv, formatarNomeNoCartao, formatarNumeroCartao, formatarValidade } from './cartao';

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

describe('cartaoCompleto', () => {
  const valido = { nome: 'Ana Paula', numero: '4111 1111 1111 1111', validade: '12/30', cvv: '123' };

  it('accepts a fully filled card', () => {
    expect(cartaoCompleto(valido)).toBe(true);
  });

  it('rejects an empty holder name', () => {
    expect(cartaoCompleto({ ...valido, nome: '   ' })).toBe(false);
  });

  it('rejects a number with fewer than sixteen digits', () => {
    expect(cartaoCompleto({ ...valido, numero: '4111 1111' })).toBe(false);
  });

  it('rejects a month outside 01-12', () => {
    expect(cartaoCompleto({ ...valido, validade: '13/30' })).toBe(false);
    expect(cartaoCompleto({ ...valido, validade: '00/30' })).toBe(false);
  });

  it('rejects an incomplete expiry date', () => {
    expect(cartaoCompleto({ ...valido, validade: '12/3' })).toBe(false);
  });

  it('rejects a cvv shorter than three digits', () => {
    expect(cartaoCompleto({ ...valido, cvv: '12' })).toBe(false);
  });
});
