-- Escola Schmidt — professor vinculado a módulo + horário (não à turma toda)
-- Rodar em: Supabase > SQL Editor, depois de 0004_autocheckin.sql

-- Um horário da grade (aulas_recorrentes) pode juntar módulos diferentes na
-- mesma aula (ex: quinta 18h atende 1,2,3,4 ao mesmo tempo), e cada módulo
-- pode ter um ou mais professores responsáveis. Por isso o vínculo é
-- (aula_recorrente, professor, módulo) numa tabela própria, não uma coluna
-- única em aulas_recorrentes — que só dava pra guardar um professor por
-- horário inteiro, cobrindo todo mundo indiscriminadamente.
create table professores_aula (
  id                  uuid primary key default gen_random_uuid(),
  aula_recorrente_id  uuid not null references aulas_recorrentes (id) on delete cascade,
  professor_id        uuid not null references perfis (id) on delete cascade,
  modulo              smallint not null check (modulo between 1 and 4),
  unique (aula_recorrente_id, professor_id, modulo)
);

create index on professores_aula (aula_recorrente_id, modulo);
create index on professores_aula (professor_id);

alter table aulas_recorrentes drop column professor_id;

alter table professores_aula enable row level security;

-- Mesmo padrão de aulas_recorrentes: todo mundo autenticado lê, só dono altera.
create policy professor_aula_leitura on professores_aula
  for select using (auth.uid() is not null);

create policy professor_aula_escrita on professores_aula
  for all using (papel_atual() = 'dono') with check (papel_atual() = 'dono');

grant select on public.professores_aula to anon;
grant select, insert, update, delete on public.professores_aula to authenticated;
grant select, insert, update, delete on public.professores_aula to service_role;

-- Pedido de presença só é visível/decidível pelo(s) professor(es)
-- responsáveis pelo módulo daquele aluno específico, ou pelo dono.
create function sou_professor_do_pedido(p_aula_id uuid, p_aluno_id uuid) returns boolean
language sql stable as $$
  select exists (
    select 1
      from aulas au
      join alunos al on al.id = p_aluno_id
      join professores_aula pa
        on pa.aula_recorrente_id = au.aula_recorrente_id
       and pa.modulo = al.modulo
     where au.id = p_aula_id
       and pa.professor_id = auth.uid()
  );
$$;

drop policy pedido_leitura on pedidos_presenca;
create policy pedido_leitura on pedidos_presenca
  for select using (
    papel_atual() = 'dono'
    or (papel_atual() = 'professor' and sou_professor_do_pedido(aula_id, aluno_id))
    or exists (select 1 from alunos a where a.id = aluno_id and a.perfil_id = auth.uid())
  );

drop policy pedido_decisao_equipe on pedidos_presenca;
create policy pedido_decisao_equipe on pedidos_presenca
  for update using (
    papel_atual() = 'dono' or (papel_atual() = 'professor' and sou_professor_do_pedido(aula_id, aluno_id))
  ) with check (
    papel_atual() = 'dono' or (papel_atual() = 'professor' and sou_professor_do_pedido(aula_id, aluno_id))
  );

drop policy pedido_remocao_equipe on pedidos_presenca;
create policy pedido_remocao_equipe on pedidos_presenca
  for delete using (
    papel_atual() = 'dono' or (papel_atual() = 'professor' and sou_professor_do_pedido(aula_id, aluno_id))
  );
