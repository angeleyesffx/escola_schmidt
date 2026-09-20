/** Remove acentos e normaliza caixa/espaços, pra busca por nome tolerar sotaque no texto digitado. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
