import { supabase } from '../../lib/supabase';
import type { Papel } from '../auth/AuthProvider';

export type Usuario = {
  id: string;
  nome: string;
  papel: Papel;
  telefone: string | null;
  ativo: boolean;
  criado_em: string;
};

export async function getUsuarios() {
  const { data, error } = await supabase
    .from('perfis')
    .select('id, nome, papel, telefone, ativo, criado_em')
    .order('nome');
  if (error) throw error;
  return data as Usuario[];
}

export async function getUsuario(id: string) {
  const { data, error } = await supabase
    .from('perfis')
    .select('id, nome, papel, telefone, ativo, criado_em')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as Usuario;
}

// Cria o login (auth.users, via trigger cria a linha em perfis) já com o
// papel escolhido. Passa pela Edge Function porque criar usuário exige a
// service_role key — não dá pra fazer isso de um RPC comum nem do client com
// a anon key (mesmo motivo de convidarAluno em src/features/alunos/api.ts).
export async function convidarUsuario(email: string, nome: string, papel: Papel) {
  const { data, error } = await supabase.functions.invoke('convidar-usuario', {
    body: { email, nome, papel },
  });
  if (error) {
    const corpo = await error.context?.json?.().catch(() => null);
    throw new Error(corpo?.error ?? 'Não foi possível enviar o convite.');
  }
  return data as { ok: true; perfil_id: string };
}

// Liberado pela policy perfil_dono_gerencia (supabase/migrations/0017) — só
// quem chama como dono consegue de fato alterar a linha de outro usuário.
export async function atualizarPapel(usuarioId: string, papel: Papel) {
  const { error } = await supabase.from('perfis').update({ papel }).eq('id', usuarioId);
  if (error) throw error;
}

export async function atualizarAtivo(usuarioId: string, ativo: boolean) {
  const { error } = await supabase.from('perfis').update({ ativo }).eq('id', usuarioId);
  if (error) throw error;
}
