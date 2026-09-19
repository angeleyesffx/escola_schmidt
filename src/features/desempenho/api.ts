import { supabase } from '../../lib/supabase';

export type NivelDesempenho = 'precisa_melhorar' | 'conforme_esperado' | 'excelente';

export type Habilidade = {
  id: string;
  nome: string;
  ordem: number;
};

export type AvaliacaoDesempenho = {
  id: string;
  habilidade_id: string;
  data: string;
  nivel: NivelDesempenho;
  observacoes: string | null;
};

export type TesteNivel = {
  id: string;
  data: string;
  modulo_de: number;
  modulo_para: number;
  aprovado: boolean;
  observacoes: string | null;
};

export async function getHabilidades() {
  const { data, error } = await supabase
    .from('habilidades')
    .select('id, nome, ordem')
    .eq('ativo', true)
    .order('ordem');
  if (error) throw error;
  return data as Habilidade[];
}

export async function getAvaliacoesAluno(alunoId: string) {
  const { data, error } = await supabase
    .from('avaliacoes_desempenho')
    .select('id, habilidade_id, data, nivel, observacoes')
    .eq('aluno_id', alunoId)
    .order('data', { ascending: false });
  if (error) throw error;
  return data as AvaliacaoDesempenho[];
}

export async function getTestesNivelAluno(alunoId: string) {
  const { data, error } = await supabase
    .from('testes_nivel')
    .select('id, data, modulo_de, modulo_para, aprovado, observacoes')
    .eq('aluno_id', alunoId)
    .order('data', { ascending: false });
  if (error) throw error;
  return data as TesteNivel[];
}

// aluno_id + habilidade_id + data tem unique constraint no banco: reavaliar
// a mesma habilidade no mesmo dia sobrescreve o registro em vez de duplicar.
export async function registrarAvaliacao(
  alunoId: string,
  habilidadeId: string,
  data: string,
  nivel: NivelDesempenho,
  observacoes: string | null,
  registradoPor: string | null
) {
  const { error } = await supabase.from('avaliacoes_desempenho').upsert(
    { aluno_id: alunoId, habilidade_id: habilidadeId, data, nivel, observacoes, registrado_por: registradoPor },
    { onConflict: 'aluno_id,habilidade_id,data' }
  );
  if (error) throw error;
}

export async function registrarTesteNivel(
  alunoId: string,
  moduloDe: number,
  moduloPara: number,
  aprovado: boolean,
  observacoes: string | null,
  professorId: string | null
) {
  const { error } = await supabase.from('testes_nivel').insert({
    aluno_id: alunoId,
    professor_id: professorId,
    modulo_de: moduloDe,
    modulo_para: moduloPara,
    aprovado,
    observacoes,
  });
  if (error) throw error;
}
