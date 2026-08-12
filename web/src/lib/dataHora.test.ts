import { describe, expect, it } from 'vitest';
import {
  dataValida,
  deDataHoraIso,
  horaValida,
  mascararData,
  mascararHora,
  paraDataHoraIso,
} from './dataHora';

describe('mascararData', () => {
  it('inserts the slashes as the user types', () => {
    expect(mascararData('1')).toBe('1');
    expect(mascararData('1608')).toBe('16/08');
    expect(mascararData('16082026')).toBe('16/08/2026');
  });

  it('ignores non-digits and stops at eight digits', () => {
    expect(mascararData('16/08/2026')).toBe('16/08/2026');
    expect(mascararData('abc16x08y2026999')).toBe('16/08/2026');
  });
});

describe('mascararHora', () => {
  it('inserts the colon as the user types', () => {
    expect(mascararHora('2')).toBe('2');
    expect(mascararHora('2030')).toBe('20:30');
    expect(mascararHora('20:30')).toBe('20:30');
  });
});

describe('dataValida', () => {
  it('accepts a real date', () => {
    expect(dataValida('16/08/2026')).toBe(true);
    expect(dataValida('29/02/2024')).toBe(true);
  });

  it('rejects incomplete input and days that do not exist in the month', () => {
    expect(dataValida('16/08')).toBe(false);
    expect(dataValida('31/02/2026')).toBe(false);
    expect(dataValida('29/02/2026')).toBe(false);
    expect(dataValida('16/13/2026')).toBe(false);
  });
});

describe('horaValida', () => {
  it('accepts a 24h time and rejects out-of-range values', () => {
    expect(horaValida('20:30')).toBe(true);
    expect(horaValida('00:00')).toBe(true);
    expect(horaValida('24:00')).toBe(false);
    expect(horaValida('20:60')).toBe(false);
    expect(horaValida('2030')).toBe(false);
  });
});

describe('conversão pro formato da API', () => {
  it('builds the ISO local date-time the backend expects', () => {
    expect(paraDataHoraIso('16/08/2026', '20:30')).toBe('2026-08-16T20:30:00');
  });

  it('reads a session date-time back into the form fields', () => {
    expect(deDataHoraIso('2026-08-16T20:30:00')).toEqual({ data: '16/08/2026', hora: '20:30' });
  });
});
