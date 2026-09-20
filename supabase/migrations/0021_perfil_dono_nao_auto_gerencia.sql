-- Escola Schmidt — dono não pode alterar papel/status da própria conta
-- Rodar em: Supabase > SQL Editor, depois de 0020_auto_vincula_aluno_por_email.sql

-- perfil_dono_gerencia (0017) libera update de qualquer perfil pro dono, sem
-- excluir a própria linha — o bloqueio de auto-rebaixamento/desativação
-- existia só em editandoSiMesmo (usuarios/[id].tsx), na UI. Uma chamada
-- direta à API sempre pôde contornar isso. Vira regra de RLS, não só de tela.
drop policy perfil_dono_gerencia on perfis;

create policy perfil_dono_gerencia on perfis
  for update
  using (papel_atual() = 'dono' and id <> auth.uid())
  with check (papel_atual() = 'dono' and id <> auth.uid());
