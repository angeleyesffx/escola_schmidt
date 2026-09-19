-- Escola Schmidt — agendamento de aula particular
-- Rodar em: Supabase > SQL Editor, depois de 0010_registrar_avaliacao_evolucao_rpc.sql

-- Aula particular é 1 aluno só, então ele vai direto na aula — diferente de
-- uma aula regular, onde o aluno só aparece via `presencas`, e só depois que
-- a aula de fato acontece e alguém abre a chamada. Um agendamento futuro
-- ainda não tem presença nenhuma, então precisa de um jeito de saber de quem
-- é a aula antes disso.
alter table aulas add column aluno_id uuid references alunos (id) on delete cascade;

alter table aulas add constraint aluno_so_em_particular check (
  (tipo = 'particular' and aluno_id is not null)
  or (tipo <> 'particular' and aluno_id is null)
);

create index on aulas (aluno_id) where aluno_id is not null;

-- Evita agendar duas particulares pro mesmo professor no mesmo horário.
create unique index aula_particular_professor_unica
  on aulas (professor_id, data, hora)
  where tipo = 'particular';

-- Aula regular/reposição continua visível pra qualquer autenticado (saber
-- que "tem aula às 18h" não expõe ninguém). Particular é dado do aluno: só a
-- equipe e o próprio aluno enxergam.
drop policy aula_leitura on aulas;
create policy aula_leitura on aulas
  for select using (
    tipo <> 'particular'
    or eh_equipe()
    or exists (select 1 from alunos a where a.id = aulas.aluno_id and a.perfil_id = auth.uid())
  );
