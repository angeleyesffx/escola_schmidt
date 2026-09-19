-- Escola Schmidt — permite professor cadastrar aluno, não só dono
-- Rodar em: Supabase > SQL Editor, depois de 0013_fix_triggers_security_definer.sql

-- A tela "Alunos > Novo aluno" sempre deixou professor entrar (só bloqueia
-- papel 'aluno'), mas a RLS de alunos/contratos só liberava escrita pra
-- 'dono' — professor tentando cadastrar aluno esbarrava em RLS silenciosa.
-- Alinha a policy com o que as outras tabelas de equipe já fazem (grade,
-- aulas, testes_nivel): eh_equipe() cobre dono e professor.
drop policy aluno_escrita on alunos;
create policy aluno_escrita on alunos
  for all using (eh_equipe()) with check (eh_equipe());

drop policy contrato_escrita on contratos;
create policy contrato_escrita on contratos
  for all using (eh_equipe()) with check (eh_equipe());
