import { criarEvento, getEventosPorPeriodo, getTiposEvento } from './api';

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

// Orquestra o fluxo completo (docs/product/eventos.md §5.1): busca os
// feriados do estado/ano, resolve o tipo "Feriado" já existente no seed de
// tipos_evento (0003) e cria 1 evento de 1 dia por feriado — pulando os que
// já existem (mesmo tipo+título+data_início) pra reimportar sem duplicar.
export async function importarFeriados(uf: string, ano: number, criadoPor: string | null) {
  const [feriados, tipos] = await Promise.all([
    buscarFeriadosEstado(uf, ano),
    getTiposEvento(),
  ]);

  const tipoFeriado = tipos.find((t) => t.nome === 'Feriado');
  if (!tipoFeriado) {
    throw new Error('Tipo de evento "Feriado" não encontrado. Cadastre-o antes de importar.');
  }

  const existentes = await getEventosPorPeriodo(`${ano}-01-01`, `${ano}-12-31`);
  const jaImportado = new Set(
    existentes
      .filter((e) => e.tipo_id === tipoFeriado.id)
      .map((e) => `${e.titulo}|${e.data_inicio}`)
  );

  let importados = 0;
  for (const feriado of feriados) {
    const chave = `${feriado.nome}|${feriado.data}`;
    if (jaImportado.has(chave)) continue;
    await criarEvento(tipoFeriado.id, feriado.nome, feriado.data, feriado.data, null, criadoPor);
    importados += 1;
  }

  return { total: feriados.length, importados };
}
