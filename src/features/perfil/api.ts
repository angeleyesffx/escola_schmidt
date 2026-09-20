import { supabase } from '../../lib/supabase';
import type { Papel } from '../auth/AuthProvider';

export type MeuPerfil = {
  id: string;
  nome: string;
  papel: Papel;
  telefone: string | null;
  criado_em: string;
};

export async function getMeuPerfil(userId: string) {
  const { data, error } = await supabase
    .from('perfis')
    .select('id, nome, papel, telefone, criado_em')
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
