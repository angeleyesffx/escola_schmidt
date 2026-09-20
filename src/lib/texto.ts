/** Remove acentos e normaliza caixa/espaços, pra busca por nome tolerar sotaque no texto digitado. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Vira slug (minusculo, sem acento, hifens no lugar de espaço/pontuação) —
 * usado nos formulários de catálogo (categorias/habilidades) pra derivar
 * `slug` a partir do `nome` digitado, mesmo padrão já usado no seed
 * (0009_minha_evolucao_seed.sql). */
export function slugify(texto: string): string {
  return normalizar(texto)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
