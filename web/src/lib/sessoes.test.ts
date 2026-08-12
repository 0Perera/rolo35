import { describe, expect, it } from 'vitest';
import type { SessaoPublicada } from '../api/sessoes';
import { contagemDeSessoes, formatarPreco, precoDoFilme, resumoDeSalas } from './sessoes';

function sessao(parcial: Partial<SessaoPublicada>): SessaoPublicada {
  return {
    id: 1,
    salaNome: 'Sala 1',
    tmdbId: 550,
    titulo: 'Clube da Luta',
    posterUrl: null,
    sinopse: null,
    dataEstreia: '1999-10-15',
    dataHora: '2030-01-01T20:00:00',
    preco: 25,
    capacidade: 40,
    esgotada: false,
    ...parcial,
  };
}

describe('precoDoFilme', () => {
  it('marks "a partir de" only when the sessions have different prices', () => {
    expect(precoDoFilme([sessao({ preco: 25 }), sessao({ preco: 15 })])).toEqual({
      texto: 'R$ 15,00',
      aPartirDe: true,
    });
  });

  it('keeps the plain price for a single session', () => {
    expect(precoDoFilme([sessao({ preco: 15 })])).toEqual({ texto: 'R$ 15,00', aPartirDe: false });
  });

  it('keeps the plain price when every session costs the same', () => {
    expect(precoDoFilme([sessao({ preco: 25 }), sessao({ preco: 25 })])).toEqual({
      texto: 'R$ 25,00',
      aPartirDe: false,
    });
  });
});

describe('formatarPreco', () => {
  it('uses the Brazilian decimal comma', () => {
    expect(formatarPreco(25.5)).toBe('R$ 25,50');
    expect(formatarPreco(10)).toBe('R$ 10,00');
  });
});

describe('resumoDeSalas', () => {
  it('names the room when there is only one, counts them otherwise', () => {
    expect(resumoDeSalas([sessao({ salaNome: 'Sala 1' }), sessao({ salaNome: 'Sala 1' })])).toBe('SALA 1');
    expect(resumoDeSalas([sessao({ salaNome: 'Sala 1' }), sessao({ salaNome: 'Sala 2' })])).toBe('2 SALAS');
  });
});

describe('contagemDeSessoes', () => {
  it('pluralises from the given total', () => {
    expect(contagemDeSessoes(1)).toBe('1 SESSÃO');
    expect(contagemDeSessoes(3)).toBe('3 SESSÕES');
  });
});
