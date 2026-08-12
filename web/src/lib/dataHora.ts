/**
 * Data e hora digitadas, no formato do handoff (`16/08/2026`, `20:30`).
 * Os inputs nativos `date`/`time` foram descartados aqui porque o calendário e a roleta
 * que eles abrem são UI do navegador, sem CSS possível — destoavam do resto do formulário.
 */

export function mascararData(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 8);
  if (digitos.length <= 2) {
    return digitos;
  }
  if (digitos.length <= 4) {
    return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  }
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

export function mascararHora(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 4);
  return digitos.length <= 2 ? digitos : `${digitos.slice(0, 2)}:${digitos.slice(2)}`;
}

export function dataValida(valor: string): boolean {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
  if (!partes) {
    return false;
  }
  const [, dia, mes, ano] = partes.map(Number);
  const data = new Date(ano, mes - 1, dia);
  return data.getDate() === dia && data.getMonth() === mes - 1 && data.getFullYear() === ano;
}

export function horaValida(valor: string): boolean {
  const partes = /^(\d{2}):(\d{2})$/.exec(valor);
  if (!partes) {
    return false;
  }
  const [, hora, minuto] = partes.map(Number);
  return hora < 24 && minuto < 60;
}

/** "16/08/2026" + "20:30" → "2026-08-16T20:30:00", o formato que a API espera. */
export function paraDataHoraIso(data: string, hora: string): string {
  const [dia, mes, ano] = data.split('/');
  return `${ano}-${mes}-${dia}T${hora}:00`;
}

/** "16/08/2026" → Date local; `null` quando o texto ainda não é uma data válida. */
export function paraDate(valor: string): Date | null {
  if (!dataValida(valor)) {
    return null;
  }
  const [dia, mes, ano] = valor.split('/').map(Number);
  return new Date(ano, mes - 1, dia);
}

/** Date → "16/08/2026" */
export function deDate(data: Date): string {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${data.getFullYear()}`;
}

/** "2026-08-16T20:30:00" → { data: "16/08/2026", hora: "20:30" } */
export function deDataHoraIso(dataHora: string): { data: string; hora: string } {
  const [ano, mes, dia] = dataHora.slice(0, 10).split('-');
  return { data: `${dia}/${mes}/${ano}`, hora: dataHora.slice(11, 16) };
}
