export type FeriadoExterno = {
  id: string;
  data: string;
  nome: string;
  tipo: string;
};

// Sinaliza falta de configuração (chave ausente) — diferente de um erro de
// rede/servidor, é seguro mostrar essa mensagem direto pro dono, porque não
// vaza nenhum detalhe do backend, só o que falta configurar no .env.
export class ConfiguracaoFeriadosError extends Error {}

export async function buscarFeriadosEstado(uf: string, ano: number) {
  const chave = process.env.EXPO_PUBLIC_FERIADOS_API_KEY;
  if (!chave) {
    throw new ConfiguracaoFeriadosError(
      'Falta configurar EXPO_PUBLIC_FERIADOS_API_KEY no .env (chave gratuita em feriadosapi.com).'
    );
  }

  const resposta = await fetch(`https://feriadosapi.com/api/v1/feriados/estado/${uf}?ano=${ano}`, {
    headers: { Authorization: `Bearer ${chave}` },
  });
  if (!resposta.ok) {
    throw new Error(`Erro ao buscar feriados (status ${resposta.status}).`);
  }

  return (await resposta.json()) as FeriadoExterno[];
}
