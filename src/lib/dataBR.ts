/**
 * Conversão de data entre o formato de digitação (DD/MM/AAAA, usado em todo
 * formulário do app) e o formato ISO (AAAA-MM-DD, usado pelo Postgres).
 */

export function hojeBR(): string {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${d.getFullYear()}`;
}

export function paraISO(dataBR: string): string | null {
  const m = dataBR.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dia, mes, ano] = m;
  return `${ano}-${mes}-${dia}`;
}

export function paraBR(dataISO: string): string {
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}
