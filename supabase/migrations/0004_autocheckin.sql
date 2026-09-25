-- Escola Schmidt — pedido de presença do aluno
-- Rodar em: Supabase > SQL Editor, depois de 0003_eventos_calendario.sql

-- Aluno não marca a própria presença direto em `presencas` — ele pede, e um
-- professor/dono aprova (ou recusa) durante a aula. Só existe pedido pra
-- aula do próprio dia e do próprio módulo — não dá pra pedir antes nem depois.

create table pedidos_presenca (
  id            uuid primary key default gen_random_uuid(),
  aula_id       uuid not null references aulas (id) on delete cascade,
  aluno_id      uuid not null references alunos (id) on delete cascade,
  status        text not null default 'pendente' check (status in ('pendente', 'aprovado')),
  solicitado_em timestamptz not null default now(),
  decidido_por  uuid references perfis (id) on delete set null,
  decidido_em   timestamptz,
  unique (aula_id, aluno_id)
);

create index on pedidos_presenca (aula_id, status);

-- Se ninguém da equipe abriu a chamada daquele dia ainda, o aluno precisa
-- poder criar a ocorrência da aula (mesma lógica de getOuCriaAula), também
-- travada em hoje + módulo do próprio aluno.
create policy aula_autocriacao_aluno on aulas
  for insert
  with check (
    tipo = 'regular'
    and data = current_date
    and exists (
      select 1
        from aulas_recorrentes ar
        join alunos a on a.perfil_id = auth.uid()
       where ar.id = aula_recorrente_id
         and ar.ativo
         and ar.dia_semana = extract(dow from current_date)
         and ar.modulos @> array[a.modulo]::smallint[]
    )
  );

alter table pedidos_presenca enable row level security;

create policy pedido_leitura on pedidos_presenca
  for select using (
    eh_equipe()
    or exists (select 1 from alunos a where a.id = aluno_id and a.perfil_id = auth.uid())
  );

create policy pedido_criacao_aluno on pedidos_presenca
  for insert
  with check (
    exists (select 1 from alunos a where a.id = aluno_id and a.perfil_id = auth.uid())
    and exists (
      select 1
        from aulas au
        join aulas_recorrentes ar on ar.id = au.aula_recorrente_id
        join alunos a on a.id = aluno_id
       where au.id = aula_id
         and au.tipo = 'regular'
         and au.data = current_date
         and ar.modulos @> array[a.modulo]::smallint[]
    )
  );

-- Aprovar (status -> aprovado) e recusar (delete, pra liberar o aluno a
-- pedir de novo) são as duas únicas ações da equipe sobre um pedido.
create policy pedido_decisao_equipe on pedidos_presenca
  for update using (eh_equipe()) with check (eh_equipe());

create policy pedido_remocao_equipe on pedidos_presenca
  for delete using (eh_equipe());

grant select on public.pedidos_presenca to anon;
grant select, insert, update, delete on public.pedidos_presenca to authenticated;
grant select, insert, update, delete on public.pedidos_presenca to service_role;
