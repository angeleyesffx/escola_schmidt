import { supabase } from '../../lib/supabase';

export type AulaRecorrente = {
  id: string;
  dia_semana: number;
  hora: string;
  modulos: number[];
};

export type ProfessorAula = {
  id: string;
  nome: string;
};

export type Aluno = {
  id: string;
  nome: string;
  modulo: number;
};

export type StatusPresenca = 'presente' | 'falta' | 'falta_justificada';

export type RegistroPresenca = {
  aluno_id: string;
  status: StatusPresenca;
  registrado_em: string;
};

// Sinaliza que outra pessoa (ou outra aba) já mudou essa presença desde que
// a tela carregou — melhor recarregar do que sobrescrever sem avisar.
export class ConflitoPresencaError extends Error {
  constructor() {
    super('Esta chamada foi atualizada por outra pessoa. Recarregue para continuar.');
    this.name = 'ConflitoPresencaError';
  }
}

export async function getAulasRecorrentesHoje(diaSemana: number) {
  const { data, error } = await supabase
    .from('aulas_recorrentes')
    .select('id, dia_semana, hora, modulos')
    .eq('dia_semana', diaSemana)
    .eq('ativo', true)
    .order('hora');
  if (error) throw error;
  return data as AulaRecorrente[];
}

export function diaSemanaPorDataISO(dataISO: string) {
  const match = dataISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error('Data invalida. Use o formato AAAA-MM-DD.');
  }
  const [, ano, mes, dia] = match;
  return new Date(Number(ano), Number(mes) - 1, Number(dia)).getDay();
}

export async function getAulasRecorrentesPorData(dataISO: string) {
  const diaSemana = diaSemanaPorDataISO(dataISO);
  return getAulasRecorrentesHoje(diaSemana);
}

// Grade fixa inteira (todos os dias da semana), pra pintar horário/módulo
// direto no calendário sem precisar navegar dia a dia primeiro.
export async function getGradeSemanal() {
  const { data, error } = await supabase
    .from('aulas_recorrentes')
    .select('id, dia_semana, hora, modulos')
    .eq('ativo', true)
    .order('dia_semana')
    .order('hora');
  if (error) throw error;
  return data as AulaRecorrente[];
}

export async function getAulaRecorrente(id: string) {
  const { data, error } = await supabase
    .from('aulas_recorrentes')
    .select('id, dia_semana, hora, modulos')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as AulaRecorrente;
}

// Um módulo pode ter mais de um professor responsável, e um mesmo horário
// pode juntar módulos diferentes — por isso o vínculo é por (aula, módulo),
// não uma coluna única na aula inteira.
export async function getProfessoresDoModulo(aulaRecorrenteId: string, modulo: number) {
  const { data, error } = await supabase
    .from('professores_aula')
    .select('professor_id, perfis(nome)')
    .eq('aula_recorrente_id', aulaRecorrenteId)
    .eq('modulo', modulo);
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.professor_id as string,
    nome: (p.perfis as unknown as { nome: string } | null)?.nome ?? 'Professor',
  })) as ProfessorAula[];
}

// Uma aula da grade só ganha uma linha em `aulas` quando alguém abre a
// chamada dela pela primeira vez naquele dia — por isso busca antes de criar.
export async function getOuCriaAula(
  aulaRecorrenteId: string,
  data: string,
  hora: string,
  professorId: string | null
) {
  const { data: existente, error: erroSelect } = await supabase
    .from('aulas')
    .select('id')
    .eq('aula_recorrente_id', aulaRecorrenteId)
    .eq('data', data)
    .maybeSingle();
  if (erroSelect) throw erroSelect;
  if (existente) return existente.id as string;

  const { data: criada, error: erroInsert } = await supabase
    .from('aulas')
    .insert({ aula_recorrente_id: aulaRecorrenteId, data, hora, tipo: 'regular', professor_id: professorId })
    .select('id')
    .single();
  if (erroInsert) {
    // Corrida: outro staff criou a mesma aula entre o select e o insert
    // acima. O índice único (aula_unica_por_data) já garante que não há
    // duplicata no banco — só falta reaproveitar a linha que o outro criou
    // em vez de propagar o erro técnico de volta pra tela.
    if (erroInsert.code === '23505') {
      const { data: existenteAposCorrida, error: erroSelectNovamente } = await supabase
        .from('aulas')
        .select('id')
        .eq('aula_recorrente_id', aulaRecorrenteId)
        .eq('data', data)
        .single();
      if (erroSelectNovamente) throw erroSelectNovamente;
      return existenteAposCorrida.id as string;
    }
    throw erroInsert;
  }
  return criada.id as string;
}

export async function getAlunosPorModulos(modulos: number[]) {
  const { data, error } = await supabase
    .from('alunos')
    .select('id, nome, modulo')
    .in('modulo', modulos)
    .eq('ativo', true)
    .order('nome');
  if (error) throw error;
  return data as Aluno[];
}

// Quem pode dar aula: dono e professor, e só quem ainda está ativo na escola.
// O aluno não aparece aqui porque aula particular não é agendada por ele, é
// agendada pra ele.
export async function getProfessores() {
  const { data, error } = await supabase
    .from('perfis')
    .select('id, nome')
    .in('papel', ['dono', 'professor'])
    .eq('ativo', true)
    .order('nome');
  if (error) throw error;
  return data as ProfessorAula[];
}

export type AulaParticular = {
  id: string;
  data: string;
  hora: string;
  observacoes: string | null;
  aluno_id: string;
  aluno_nome: string;
  professor_id: string;
  professor_nome: string;
};

type AulaParticularLinha = {
  id: string;
  data: string;
  hora: string;
  observacoes: string | null;
  aluno_id: string | null;
  professor_id: string | null;
  alunos: { nome: string } | null;
  perfis: { nome: string } | null;
};

// Diferente da aula regular, a particular é 1 aluno só — por isso o vínculo
// vai direto na aula (aluno_id), não espera uma presença ser registrada. A
// RLS de `aulas` já garante que só a equipe e o próprio aluno leem essa
// linha quando tipo = 'particular'.
export async function getAulasParticularesPorPeriodo(inicioISO: string, fimISO: string) {
  const { data, error } = await supabase
    .from('aulas')
    .select('id, data, hora, observacoes, aluno_id, professor_id, alunos(nome), perfis(nome)')
    .eq('tipo', 'particular')
    .gte('data', inicioISO)
    .lte('data', fimISO)
    .order('data')
    .order('hora');
  if (error) throw error;

  return ((data ?? []) as unknown as AulaParticularLinha[]).map((linha) => ({
    id: linha.id,
    data: linha.data,
    hora: linha.hora,
    observacoes: linha.observacoes,
    aluno_id: linha.aluno_id ?? '',
    aluno_nome: linha.alunos?.nome ?? 'Aluno',
    professor_id: linha.professor_id ?? '',
    professor_nome: linha.perfis?.nome ?? 'Professor',
  })) as AulaParticular[];
}

export async function criarAulaParticular(
  alunoId: string,
  professorId: string,
  data: string,
  hora: string,
  observacoes: string | null
) {
  const { error } = await supabase
    .from('aulas')
    .insert({ tipo: 'particular', aluno_id: alunoId, professor_id: professorId, data, hora, observacoes });
  if (error) throw error;
}

export async function excluirAulaParticular(id: string) {
  const { error } = await supabase.from('aulas').delete().eq('id', id).eq('tipo', 'particular');
  if (error) throw error;
}

// Só data/hora — aluno/professor da reserva são fixos (decisão registrada em
// docs/product/chamada-agenda-frequencia.md §7.2). A RPC (0026) garante isso
// no banco, não só aqui; esta função só repassa os 3 parâmetros que ela aceita.
export async function remarcarAulaParticular(aulaId: string, novaData: string, novaHora: string) {
  const { error } = await supabase.rpc('remarcar_aula_particular', {
    p_aula_id: aulaId,
    p_nova_data: novaData,
    p_nova_hora: novaHora,
  });
  if (error) throw error;
}

export type TipoRecorrencia = 'unica' | 'diaria' | 'semanal' | 'mensal' | 'anual';

export type DisponibilidadeParticular = {
  id: string;
  data_inicio: string;
  data_fim: string | null;
  tipo_recorrencia: TipoRecorrencia;
  horas: string[];
};

// Horários livres que o próprio professor cadastrou pra dar particular —
// nunca "qualquer hora vaga", só o que ele abriu de propósito. Cada linha é
// um padrão de data (dia único, ou recorrência diária/semanal/mensal/anual
// entre início e fim — supabase/migrations/0019), não mais um dia_semana fixo.
export async function getDisponibilidadeProfessor(professorId: string) {
  const { data, error } = await supabase
    .from('disponibilidade_particular')
    .select('id, data_inicio, data_fim, tipo_recorrencia, horas')
    .eq('professor_id', professorId)
    .order('data_inicio');
  if (error) throw error;
  return data as DisponibilidadeParticular[];
}

export async function criarDisponibilidade(
  professorId: string,
  dataInicio: string,
  dataFim: string | null,
  tipoRecorrencia: TipoRecorrencia,
  horas: string[]
) {
  const { error } = await supabase.from('disponibilidade_particular').insert({
    professor_id: professorId,
    data_inicio: dataInicio,
    data_fim: tipoRecorrencia === 'unica' ? null : dataFim,
    tipo_recorrencia: tipoRecorrencia,
    horas,
  });
  if (error) throw error;
}

export async function excluirDisponibilidade(id: string) {
  const { error } = await supabase.from('disponibilidade_particular').delete().eq('id', id);
  if (error) throw error;
}

// O cálculo de "qual horário está livre nessa data" (cruzar disponibilidade
// cadastrada, aula regular da grade e outras particulares já marcadas) agora
// mora no banco (horarios_livres_particular, 0019) — resolver recorrência
// diária/semanal/mensal/anual no client duplicaria a mesma lógica ali.
export async function getHorariosLivresProfessor(professorId: string, dataISO: string) {
  const { data, error } = await supabase.rpc('horarios_livres_particular', {
    p_professor_id: professorId,
    p_data: dataISO,
  });
  if (error) throw error;
  return (data ?? []).map((linha: { hora: string }) => linha.hora as string);
}

export type ResponsabilidadeProfessor = {
  id: string;
  aula_recorrente_id: string;
  modulo: number;
};

// Quais (horário da grade, módulo) o professor já reivindicou pra si —
// alimenta a tela "Meus módulos", onde ele mesmo marca/desmarca em vez de
// depender do dono pra isso (supabase/migrations/0018).
export async function getResponsabilidadesProfessor(professorId: string) {
  const { data, error } = await supabase
    .from('professores_aula')
    .select('id, aula_recorrente_id, modulo')
    .eq('professor_id', professorId);
  if (error) throw error;
  return data as ResponsabilidadeProfessor[];
}

export async function adicionarResponsabilidade(professorId: string, aulaRecorrenteId: string, modulo: number) {
  const { data, error } = await supabase
    .from('professores_aula')
    .insert({ professor_id: professorId, aula_recorrente_id: aulaRecorrenteId, modulo })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function removerResponsabilidade(id: string) {
  const { error } = await supabase.from('professores_aula').delete().eq('id', id);
  if (error) throw error;
}

export type CandidatoAulaTeste = {
  id: string;
  nome: string;
  telefone: string | null;
};

export type AulaTeste = {
  id: string;
  aula_recorrente_id: string;
  data: string;
  observacoes: string | null;
  dia_semana: number;
  hora: string;
  modulos: number[];
  candidatos: CandidatoAulaTeste[];
};

type AulaTesteLinha = {
  id: string;
  aula_recorrente_id: string;
  data: string;
  observacoes: string | null;
  aulas_recorrentes: { dia_semana: number; hora: string; modulos: number[] } | null;
  aulas_teste_candidatos: CandidatoAulaTeste[];
};

// Aula teste não mora em `aulas` (que trava 1 aluno por particular) — é um
// agendamento à parte que sempre aponta pra um horário já existente da grade
// e pode juntar vários candidatos na mesma data (supabase/migrations/0018).
// Candidato é texto livre (nome/telefone), não FK pra `alunos` — quem faz
// aula teste ainda não está matriculado (supabase/migrations/0027).
export async function getAulasTestePorPeriodo(inicioISO: string, fimISO: string) {
  const { data, error } = await supabase
    .from('aulas_teste')
    .select(
      'id, aula_recorrente_id, data, observacoes, aulas_recorrentes(dia_semana, hora, modulos), aulas_teste_candidatos(id, nome, telefone)'
    )
    .gte('data', inicioISO)
    .lte('data', fimISO)
    .order('data');
  if (error) throw error;

  return ((data ?? []) as unknown as AulaTesteLinha[]).map((linha) => ({
    id: linha.id,
    aula_recorrente_id: linha.aula_recorrente_id,
    data: linha.data,
    observacoes: linha.observacoes,
    dia_semana: linha.aulas_recorrentes?.dia_semana ?? 0,
    hora: linha.aulas_recorrentes?.hora ?? '',
    modulos: linha.aulas_recorrentes?.modulos ?? [],
    candidatos: linha.aulas_teste_candidatos ?? [],
  })) as AulaTeste[];
}

// Alimenta a seção "Aula Experimental" da chamada (chamada/[id].tsx) — só o
// nome/telefone dos candidatos daquele slot+data, sem presença formal
// (decisão 3 de docs/product/chamada-agenda-frequencia.md §7.2).
export async function getCandidatosTesteDoDia(aulaRecorrenteId: string, data: string) {
  const { data: linhas, error } = await supabase
    .from('aulas_teste')
    .select('aulas_teste_candidatos(id, nome, telefone)')
    .eq('aula_recorrente_id', aulaRecorrenteId)
    .eq('data', data);
  if (error) throw error;

  return ((linhas ?? []) as unknown as { aulas_teste_candidatos: CandidatoAulaTeste[] }[]).flatMap(
    (linha) => linha.aulas_teste_candidatos ?? []
  );
}

export async function criarAulaTeste(
  aulaRecorrenteId: string,
  data: string,
  candidatos: { nome: string; telefone: string | null }[],
  observacoes: string | null
) {
  const { data: criada, error } = await supabase
    .from('aulas_teste')
    .insert({ aula_recorrente_id: aulaRecorrenteId, data, observacoes })
    .select('id')
    .single();
  if (error) throw error;

  const { error: erroCandidatos } = await supabase
    .from('aulas_teste_candidatos')
    .insert(candidatos.map((c) => ({ aula_teste_id: criada.id, nome: c.nome, telefone: c.telefone })));
  if (erroCandidatos) throw erroCandidatos;

  return criada.id as string;
}

export async function excluirAulaTeste(id: string) {
  const { error } = await supabase.from('aulas_teste').delete().eq('id', id);
  if (error) throw error;
}

export type StatusPedido = 'pendente' | 'aprovado';

export type PedidoPresenca = {
  id: string;
  aula_id: string;
  aluno_id: string;
  status: StatusPedido;
  solicitado_em: string;
};

export type PedidoPendente = PedidoPresenca & { aluno_nome: string };

// O aluno não escreve em `presencas` direto — ele pede, e a política de RLS
// só deixa criar o pedido pra aula de hoje, do próprio módulo.
export async function pedirPresenca(aulaId: string, alunoId: string) {
  const { data, error } = await supabase
    .from('pedidos_presenca')
    .insert({ aula_id: aulaId, aluno_id: alunoId })
    .select('id, aula_id, aluno_id, status, solicitado_em')
    .single();
  if (error) throw error;
  return data as PedidoPresenca;
}

export async function getMeuPedido(aulaId: string, alunoId: string) {
  const { data, error } = await supabase
    .from('pedidos_presenca')
    .select('id, aula_id, aluno_id, status, solicitado_em')
    .eq('aula_id', aulaId)
    .eq('aluno_id', alunoId)
    .maybeSingle();
  if (error) throw error;
  return data as PedidoPresenca | null;
}

// Pra equipe revisar durante a aula — só o que ainda não foi decidido.
export async function getPedidosPendentes(aulaId: string) {
  const { data, error } = await supabase
    .from('pedidos_presenca')
    .select('id, aula_id, aluno_id, status, solicitado_em, alunos(nome)')
    .eq('aula_id', aulaId)
    .eq('status', 'pendente')
    .order('solicitado_em');
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id as string,
    aula_id: p.aula_id as string,
    aluno_id: p.aluno_id as string,
    status: p.status as StatusPedido,
    solicitado_em: p.solicitado_em as string,
    aluno_nome: (p.alunos as unknown as { nome: string } | null)?.nome ?? 'Aluno',
  })) as PedidoPendente[];
}

// Aprovar grava a presença de verdade (reaproveitando marcarPresenca — se a
// equipe já tinha marcado esse aluno por fora, o conflito é só ignorado, já
// que o resultado final que importa é "presente") e fecha o pedido.
export async function aprovarPedido(pedido: PedidoPresenca, decididoPor: string | null) {
  try {
    await marcarPresenca(pedido.aula_id, pedido.aluno_id, 'presente', decididoPor, null);
  } catch (err) {
    if (!(err instanceof ConflitoPresencaError)) throw err;
  }

  const { error } = await supabase
    .from('pedidos_presenca')
    .update({ status: 'aprovado', decidido_por: decididoPor, decidido_em: new Date().toISOString() })
    .eq('id', pedido.id);
  if (error) throw error;
}

// Recusar apaga o pedido em vez de guardar um status "recusado" — assim o
// aluno pode simplesmente pedir de novo se foi engano.
export async function recusarPedido(pedidoId: string) {
  const { error } = await supabase.from('pedidos_presenca').delete().eq('id', pedidoId);
  if (error) throw error;
}

export async function getPresencas(aulaId: string) {
  const { data, error } = await supabase
    .from('presencas')
    .select('aluno_id, status, registrado_em')
    .eq('aula_id', aulaId);
  if (error) throw error;
  return data as RegistroPresenca[];
}

// versaoConhecida é o `registrado_em` que a tela tinha na última leitura
// (ou null se nunca existiu presença pra esse aluno nessa aula). Se o valor
// no banco não bater mais com isso, alguém mexeu no meio do caminho.
export async function marcarPresenca(
  aulaId: string,
  alunoId: string,
  status: StatusPresenca,
  registradoPor: string | null,
  versaoConhecida: string | null
) {
  const { data: atual, error: erroSelect } = await supabase
    .from('presencas')
    .select('registrado_em')
    .eq('aula_id', aulaId)
    .eq('aluno_id', alunoId)
    .maybeSingle();
  if (erroSelect) throw erroSelect;

  const versaoAtual = atual?.registrado_em ?? null;
  if (versaoAtual !== versaoConhecida) {
    throw new ConflitoPresencaError();
  }

  const agora = new Date().toISOString();
  const { error } = await supabase
    .from('presencas')
    .upsert(
      { aula_id: aulaId, aluno_id: alunoId, status, registrado_por: registradoPor, registrado_em: agora },
      { onConflict: 'aula_id,aluno_id' }
    );
  if (error) throw error;

  return agora;
}
