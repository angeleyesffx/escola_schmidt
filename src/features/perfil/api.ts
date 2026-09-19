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

export async function atualizarMeuPerfil(userId: string, payload: { nome: string; telefone: string | null }) {
  const { error } = await supabase
    .from('perfis')
    .update({ nome: payload.nome, telefone: payload.telefone })
    .eq('id', userId);
  if (error) throw error;
}
