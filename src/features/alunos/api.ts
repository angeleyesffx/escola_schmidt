import { supabase } from '../../lib/supabase';
import type { StatusPresenca } from '../chamada/api';

export type Plano = 'mensal' | 'trimestral' | 'semestral' | 'anual';

export type Aluno = {
  id: string;
  nome: string;
  data_nascimento: string | null;
  modulo: number;
  responsavel_nome: string | null;
  responsavel_telefone: string | null;
  responsavel_email: string | null;
  ativo: boolean;
  perfil_id: string | null;
};

export type PerfilAluno = {
  id: string;
  nome: string;
  telefone: string | null;
  criado_em: string;
};

export type NovoAluno = {
  nome: string;
  data_nascimento: string | null;
  modulo: number;
  responsavel_nome: string | null;
  responsavel_telefone: string | null;
  // Contra esse e-mail (normalizado) o gatilho `vincula_aluno_por_email` casa
  // o cadastro público automaticamente — sem isso, a conta nasce órfã e
  // precisa do vínculo manual na ficha do aluno.
  responsavel_email: string | null;
};

export type NovoContrato = {
  plano: Plano;
  data_inicio: string;
  data_fim: string;
};

export async function getAlunos() {
  const { data, error } = await supabase
    .from('alunos')
    .select(
      'id, nome, data_nascimento, modulo, responsavel_nome, responsavel_telefone, responsavel_email, ativo, perfil_id'
    )
    .order('nome');
  if (error) throw error;
  return data as Aluno[];
}

export async function getAluno(id: string) {
  const { data, error } = await supabase
    .from('alunos')
    .select(
      'id, nome, data_nascimento, modulo, responsavel_nome, responsavel_telefone, responsavel_email, ativo, perfil_id'
    )
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Aluno;
}

export async function getPerfilVinculado(perfilId: string) {
  const { data, error } = await supabase
    .from('perfis')
    .select('id, nome, telefone, criado_em')
    .eq('id', perfilId)
    .single();
  if (error) throw error;
  return data as PerfilAluno;
}

// Conta de responsável/aluno com papel 'aluno' que já fez cadastro (signup
// público) mas ainda não foi ligada a nenhum registro da lista de alunos.
export async function getPerfisNaoVinculados() {
  const [{ data: perfis, error: erroPerfis }, { data: alunos, error: erroAlunos }] = await Promise.all([
    supabase
      .from('perfis')
      .select('id, nome, telefone, criado_em')
      .eq('papel', 'aluno')
      .order('criado_em', { ascending: false }),
    supabase.from('alunos').select('perfil_id').not('perfil_id', 'is', null),
  ]);
  if (erroPerfis) throw erroPerfis;
  if (erroAlunos) throw erroAlunos;

  const vinculados = new Set((alunos ?? []).map((a) => a.perfil_id));
  return ((perfis ?? []) as PerfilAluno[]).filter((p) => !vinculados.has(p.id));
}

export async function vincularPerfil(alunoId: string, perfilId: string) {
  const { error } = await supabase.from('alunos').update({ perfil_id: perfilId }).eq('id', alunoId);
  if (error) throw error;
}

export async function desvincularPerfil(alunoId: string) {
  const { error } = await supabase.from('alunos').update({ perfil_id: null }).eq('id', alunoId);
  if (error) throw error;
}

export type RegistroFrequencia = {
  status: StatusPresenca;
  data: string;
  hora: string;
};

type PresencaComAula = {
  status: StatusPresenca;
  aulas: { data: string; hora: string } | null;
};

export async function getFrequenciaAluno(alunoId: string) {
  const { data, error } = await supabase
    .from('presencas')
    .select('status, aulas!inner(data, hora)')
    .eq('aluno_id', alunoId);
  if (error) throw error;

  const registros = ((data ?? []) as unknown as PresencaComAula[])
    .filter((linha) => linha.aulas !== null)
    .map((linha) => ({
      status: linha.status,
      data: linha.aulas!.data,
      hora: linha.aulas!.hora.slice(0, 5),
    }));

  registros.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  return registros as RegistroFrequencia[];
}

export type Contrato = {
  id: string;
  plano: Plano;
  data_inicio: string;
  data_fim: string;
};

// O contrato vigente (ou, se nenhum cobre hoje, o mais recente) é a base pra
// saber quantas aulas por semana foram contratadas nesse período — a
// frequência do aluno é medida contra isso, não contra o total bruto de
// presenças já registradas.
export async function getContratoAtual(alunoId: string) {
  const { data, error } = await supabase
    .from('contratos')
    .select('id, plano, data_inicio, data_fim')
    .eq('aluno_id', alunoId)
    .order('data_inicio', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as Contrato | null;
}

// Cria o login do aluno/responsável (auth.users) e já vincula ao registro em
// `alunos`. Passa pela Edge Function convidar-aluno porque criar usuário
// exige a service_role key — não dá pra fazer isso de um RPC comum nem do
// client com a anon key.
export async function convidarAluno(alunoId: string, email: string) {
  const { data, error } = await supabase.functions.invoke('convidar-aluno', {
    body: { aluno_id: alunoId, email },
  });
  if (error) {
    const corpo = await error.context?.json?.().catch(() => null);
    throw new Error(corpo?.error ?? 'Não foi possível enviar o convite.');
  }
  return data as { ok: true; perfil_id: string };
}

export async function criarAluno(aluno: NovoAluno, contrato: NovoContrato) {
  const { data: alunoCriado, error: erroAluno } = await supabase
    .from('alunos')
    .insert(aluno)
    .select('id')
    .single();
  if (erroAluno) throw erroAluno;

  const { error: erroContrato } = await supabase.from('contratos').insert({
    aluno_id: alunoCriado.id,
    plano: contrato.plano,
    data_inicio: contrato.data_inicio,
    data_fim: contrato.data_fim,
  });
  if (erroContrato) throw erroContrato;

  return alunoCriado.id as string;
}

export type DadosAluno = {
  nome: string;
  data_nascimento: string | null;
  responsavel_nome: string | null;
  responsavel_telefone: string | null;
};

// Mesmos 4 campos do cadastro de "novo aluno" — módulo e plano ficam de fora
// de propósito, são decisão da equipe (módulo muda por teste de nível, plano
// é contrato/cobrança). Passa pela RPC porque a RLS de `alunos` só libera
// escrita direta pra dono.
export async function atualizarDadosAluno(alunoId: string, dados: DadosAluno) {
  const { error } = await supabase.rpc('atualizar_meus_dados_aluno', {
    p_aluno_id: alunoId,
    p_nome: dados.nome,
    p_data_nascimento: dados.data_nascimento,
    p_responsavel_nome: dados.responsavel_nome,
    p_responsavel_telefone: dados.responsavel_telefone,
  });
  if (error) throw error;
}
