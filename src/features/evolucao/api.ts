import { supabase } from '../../lib/supabase';

import type {
  AvaliacaoDetalhadaEvolucaoInput,
  AvaliacaoEvolucaoResumo,
  AvaliacaoRapidaEvolucaoInput,
  CriterioHabilidadeEvolucao,
  HistoricoNivelEvolucao,
  MetodologiaAtualAluno,
  MetodologiaDisponivel,
  RequisitoNivelEvolucao,
  StatusAtualHabilidade,
} from './types';

export function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function primeiroItem<T>(valor: T | T[] | null | undefined) {
  if (Array.isArray(valor)) {
    return valor[0] ?? null;
  }
  return valor ?? null;
}

export async function getMetodologiaAtualAluno(alunoId: string, dataReferencia = hojeISO()) {
  const { data, error } = await supabase
    .from('aluno_metodologias')
    .select(
      `
        metodologia_id,
        nivel_atual_id,
        data_inicio,
        data_fim,
        metodologias_evolucao(nome),
        niveis_evolucao(nome, ordem)
      `
    )
    .eq('aluno_id', alunoId)
    .order('data_inicio', { ascending: false });

  if (error) throw error;

  const atual = (data ?? []).find((item: any) => {
    const inicio = item.data_inicio as string;
    const fim = item.data_fim as string | null;
    return inicio <= dataReferencia && (fim == null || fim >= dataReferencia);
  });

  if (!atual) return null;

  const metodologia = primeiroItem<{ nome: string }>(atual.metodologias_evolucao);
  const nivel = primeiroItem<{ nome: string; ordem: number }>(atual.niveis_evolucao);

  return {
    metodologiaId: atual.metodologia_id,
    metodologiaNome: metodologia?.nome ?? 'Metodologia ativa',
    nivelAtualId: atual.nivel_atual_id,
    nivelAtualNome: nivel?.nome ?? null,
    nivelAtualOrdem: nivel?.ordem ?? null,
    dataInicio: atual.data_inicio,
    dataFim: atual.data_fim,
  } as MetodologiaAtualAluno;
}

// Alimenta o formulário de "atribuir metodologia" (EvolucaoScreen, achado
// 4.2 de evolucao-vs-desempenho.md) — lista as metodologias em vigor com
// seus níveis já aninhados, pra staff escolher sem uma segunda consulta.
export async function getMetodologiasAtivas() {
  const { data, error } = await supabase
    .from('metodologias_evolucao')
    .select('id, nome, niveis_evolucao(id, nome, ordem)')
    .eq('ativa', true)
    .order('nome');

  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    id: item.id,
    nome: item.nome,
    niveis: ((item.niveis_evolucao ?? []) as { id: string; nome: string; ordem: number }[])
      .slice()
      .sort((a, b) => a.ordem - b.ordem),
  })) as MetodologiaDisponivel[];
}

export async function atribuirMetodologiaAluno(alunoId: string, metodologiaId: string, nivelId: string) {
  const { data, error } = await supabase.rpc('atribuir_metodologia_aluno', {
    p_aluno_id: alunoId,
    p_metodologia_id: metodologiaId,
    p_nivel_id: nivelId,
  });
  if (error) throw error;
  return data as string;
}

// Registra "nível conquistado" — o trigger aplica_promocao_nivel_evolucao
// (0025) reage a esse insert e avança aluno_metodologias.nivel_atual_id e
// alunos.modulo sozinho; esta função só chama a RPC de validação.
export async function registrarPromocaoNivel(alunoId: string, nivelId: string, observacoes?: string | null) {
  const { data, error } = await supabase.rpc('registrar_promocao_nivel', {
    p_aluno_id: alunoId,
    p_nivel_id: nivelId,
    p_observacoes: observacoes ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function getStatusHabilidadesAluno(alunoId: string) {
  const { data, error } = await supabase
    .from('status_habilidade_aluno')
    .select(
      `
        habilidade_id,
        status_atual,
        percentual_atual,
        precisa_atencao,
        prioridade_atual,
        habilidades_catalogo!inner(
          nome,
          categorias_habilidade!inner(id, nome)
        )
      `
    )
    .eq('aluno_id', alunoId);

  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    habilidadeId: item.habilidade_id,
    categoriaId: item.habilidades_catalogo.categorias_habilidade.id,
    categoriaNome: item.habilidades_catalogo.categorias_habilidade.nome,
    habilidadeNome: item.habilidades_catalogo.nome,
    statusAtual: item.status_atual,
    percentualAtual: item.percentual_atual,
    precisaAtencao: item.precisa_atencao,
    prioridadeAtual: item.prioridade_atual,
  })) as StatusAtualHabilidade[];
}

export async function getRequisitosNivel(nivelId: string) {
  const { data, error } = await supabase
    .from('requisitos_nivel_evolucao')
    .select(
      `
        habilidade_id,
        obrigatorio,
        peso,
        nota_minima,
        status_minimo,
        habilidades_catalogo!inner(
          nome,
          categorias_habilidade!inner(id, nome)
        )
      `
    )
    .eq('nivel_id', nivelId);

  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    habilidadeId: item.habilidade_id,
    habilidadeNome: item.habilidades_catalogo.nome,
    categoriaId: item.habilidades_catalogo.categorias_habilidade.id,
    categoriaNome: item.habilidades_catalogo.categorias_habilidade.nome,
    obrigatorio: item.obrigatorio,
    peso: item.peso,
    notaMinima: item.nota_minima,
    statusMinimo: item.status_minimo,
  })) as RequisitoNivelEvolucao[];
}

export async function getCriteriosHabilidades(habilidadeIds: string[]) {
  if (habilidadeIds.length === 0) return [] as CriterioHabilidadeEvolucao[];

  const { data, error } = await supabase
    .from('criterios_habilidade')
    .select('id, habilidade_id, nome, descricao, ordem, peso')
    .in('habilidade_id', habilidadeIds)
    .eq('ativo', true)
    .order('ordem', { ascending: true })
    .order('nome', { ascending: true });

  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    id: item.id,
    habilidadeId: item.habilidade_id,
    nome: item.nome,
    descricao: item.descricao,
    ordem: item.ordem,
    peso: item.peso,
  })) as CriterioHabilidadeEvolucao[];
}

async function registrarAvaliacaoEvolucaoRpc(
  input: AvaliacaoRapidaEvolucaoInput | AvaliacaoDetalhadaEvolucaoInput,
  criterios: AvaliacaoDetalhadaEvolucaoInput['criterios']
) {
  const dataAvaliacao = input.dataAvaliacao ?? hojeISO();
  const payload: Record<string, unknown> = {
    p_aluno_id: input.alunoId,
    p_habilidade_id: input.habilidadeId,
    p_metodologia_id: input.metodologiaId,
    p_professor_id: input.professorId,
    p_data_avaliacao: dataAvaliacao,
    p_precisa_atencao: input.precisaAtencao,
    p_prioridade_treinamento: input.prioridadeTreinamento,
    p_observacoes: input.observacoes,
    p_criterios: criterios.map((criterio) => ({
      criterio_id: criterio.criterioId,
      percentual: criterio.percentual,
      observacoes: criterio.observacoes,
    })),
  };

  if (criterios.length === 0 && 'status' in input) {
    payload.p_status = input.status;
    payload.p_percentual_geral = input.percentualGeral;
  }

  const { data, error } = await supabase.rpc('registrar_avaliacao_evolucao', payload);

  if (error) throw error;
  return data as string;
}

export async function registrarAvaliacaoRapidaEvolucao(input: AvaliacaoRapidaEvolucaoInput) {
  return registrarAvaliacaoEvolucaoRpc(input, []);
}

export async function registrarAvaliacaoDetalhadaEvolucao(input: AvaliacaoDetalhadaEvolucaoInput) {
  return registrarAvaliacaoEvolucaoRpc(input, input.criterios);
}

export async function getHistoricoNivelAluno(alunoId: string) {
  const { data, error } = await supabase
    .from('historico_nivel_evolucao')
    .select('id, tipo, data_evento, nivel_id, observacoes, niveis_evolucao(nome)')
    .eq('aluno_id', alunoId)
    .order('data_evento', { ascending: false })
    .order('criado_em', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    id: item.id,
    tipo: item.tipo,
    dataEvento: item.data_evento,
    nivelId: item.nivel_id,
    nivelNome: primeiroItem<{ nome: string }>(item.niveis_evolucao)?.nome ?? null,
    observacoes: item.observacoes,
  })) as HistoricoNivelEvolucao[];
}

// Alimenta a tela de Jornada (alunos/[id]/jornada.tsx) — histórico completo
// de avaliações por habilidade, cruzado com o histórico de nível acima pra
// montar a timeline. Diferente de getStatusHabilidadesAluno (só o snapshot
// atual), aqui é toda a série de avaliações registradas.
export async function getAvaliacoesEvolucaoAluno(alunoId: string) {
  const { data, error } = await supabase
    .from('avaliacoes_evolucao')
    .select('id, habilidade_id, data_avaliacao, status, percentual_geral, observacoes, habilidades_catalogo(nome)')
    .eq('aluno_id', alunoId)
    .order('data_avaliacao', { ascending: false })
    .order('criado_em', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((item: any) => ({
    id: item.id,
    habilidadeId: item.habilidade_id,
    habilidadeNome: primeiroItem<{ nome: string }>(item.habilidades_catalogo)?.nome ?? 'Habilidade',
    dataAvaliacao: item.data_avaliacao,
    status: item.status,
    percentualGeral: item.percentual_geral,
    observacoes: item.observacoes,
  })) as AvaliacaoEvolucaoResumo[];
}