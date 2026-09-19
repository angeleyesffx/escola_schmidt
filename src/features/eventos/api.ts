import { supabase } from '../../lib/supabase';

export type TipoEvento = {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
};

export type EventoCalendario = {
  id: string;
  tipo_id: string;
  titulo: string;
  data_inicio: string;
  data_fim: string;
  descricao: string | null;
};

export async function getTiposEvento() {
  const { data, error } = await supabase
    .from('tipos_evento')
    .select('id, nome, cor, ordem')
    .eq('ativo', true)
    .order('ordem');
  if (error) throw error;
  return data as TipoEvento[];
}

// Traz qualquer evento cujo período tenha interseção com [inicioISO, fimISO]
// — cobre tanto evento de um dia só quanto um recesso de semanas.
export async function getEventosPorPeriodo(inicioISO: string, fimISO: string) {
  const { data, error } = await supabase
    .from('eventos_calendario')
    .select('id, tipo_id, titulo, data_inicio, data_fim, descricao')
    .lte('data_inicio', fimISO)
    .gte('data_fim', inicioISO)
    .order('data_inicio');
  if (error) throw error;
  return data as EventoCalendario[];
}

export async function getEvento(id: string) {
  const { data, error } = await supabase
    .from('eventos_calendario')
    .select('id, tipo_id, titulo, data_inicio, data_fim, descricao')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as EventoCalendario;
}

export async function criarEvento(
  tipoId: string,
  titulo: string,
  dataInicio: string,
  dataFim: string,
  descricao: string | null,
  criadoPor: string | null
) {
  const { error } = await supabase.from('eventos_calendario').insert({
    tipo_id: tipoId,
    titulo,
    data_inicio: dataInicio,
    data_fim: dataFim,
    descricao,
    criado_por: criadoPor,
  });
  if (error) throw error;
}

export async function atualizarEvento(
  id: string,
  tipoId: string,
  titulo: string,
  dataInicio: string,
  dataFim: string,
  descricao: string | null
) {
  const { error } = await supabase
    .from('eventos_calendario')
    .update({ tipo_id: tipoId, titulo, data_inicio: dataInicio, data_fim: dataFim, descricao })
    .eq('id', id);
  if (error) throw error;
}

export async function excluirEvento(id: string) {
  const { error } = await supabase.from('eventos_calendario').delete().eq('id', id);
  if (error) throw error;
}
