import { supabase } from '../../lib/supabase';
import type { Papel } from '../auth/AuthProvider';

export type MeuPerfil = {
  id: string;
  nome: string;
  papel: Papel;
  telefone: string | null;
  avatar_path: string | null;
  criado_em: string;
};

export async function getMeuPerfil(userId: string) {
  const { data, error } = await supabase
    .from('perfis')
    .select('id, nome, papel, telefone, avatar_path, criado_em')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data as MeuPerfil;
}

// Passa pela RPC porque a policy de auto-edição de `perfis` foi removida
// (supabase/migrations/0017) — sem coluna restrita, ela deixava qualquer
// usuário alterar o próprio papel/ativo direto pelo client.
export async function atualizarMeuPerfil(payload: { nome: string; telefone: string | null }) {
  const { error } = await supabase.rpc('atualizar_meu_perfil', {
    p_nome: payload.nome,
    p_telefone: payload.telefone,
  });
  if (error) throw error;
}

export async function atualizarEmailLogin(email: string) {
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw error;
}

export function getAvatarUrl(path: string | null) {
  if (!path) return null;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return `${data.publicUrl}?v=${encodeURIComponent(path)}`;
}

export async function enviarAvatar(userId: string, uri: string, contentType = 'image/jpeg') {
  const response = await fetch(uri);
  const blob = await response.blob();
  const path = `${userId}/avatar`;

  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob, {
    contentType,
    upsert: true,
    cacheControl: '3600',
  });
  if (uploadError) throw uploadError;

  const { error: profileError } = await supabase.rpc('atualizar_avatar_perfil', { p_avatar_path: path });
  if (profileError) throw profileError;
  return path;
}

export async function removerAvatar(userId: string) {
  const path = `${userId}/avatar`;
  const { error: removeError } = await supabase.storage.from('avatars').remove([path]);
  if (removeError) throw removeError;

  const { error: profileError } = await supabase.rpc('atualizar_avatar_perfil', { p_avatar_path: null });
  if (profileError) throw profileError;
}

export async function enviarAvatarAluno(userId: string, alunoId: string, uri: string, contentType = 'image/jpeg') {
  const response = await fetch(uri);
  const blob = await response.blob();
  const path = `${userId}/aluno-${alunoId}`;

  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, blob, {
    contentType,
    upsert: true,
    cacheControl: '3600',
  });
  if (uploadError) throw uploadError;

  const { error: profileError } = await supabase.rpc('atualizar_avatar_aluno', {
    p_aluno_id: alunoId,
    p_avatar_path: path,
  });
  if (profileError) throw profileError;
  return path;
}

export async function removerAvatarAluno(userId: string, alunoId: string) {
  const path = `${userId}/aluno-${alunoId}`;
  const { error: removeError } = await supabase.storage.from('avatars').remove([path]);
  if (removeError) throw removeError;

  const { error: profileError } = await supabase.rpc('atualizar_avatar_aluno', {
    p_aluno_id: alunoId,
    p_avatar_path: null,
  });
  if (profileError) throw profileError;
}
