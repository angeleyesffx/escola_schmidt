-- Escola Schmidt — professor autogerencia módulos, e agendamento de aula teste
-- Rodar em: Supabase > SQL Editor, depois de 0017_perfis_gestao_dono.sql

-- ---------------------------------------------------------------------------
-- Professor escolhe, dentro dos dias/horários já existentes na grade, por
-- quais módulos é responsável — antes só o dono conseguia mexer aqui.
-- Continua sem poder criar/editar o horário em si (aulas_recorrentes segue
-- dono-only) nem atribuir outro professor no lugar dele.
-- ---------------------------------------------------------------------------

drop policy professor_aula_escrita on professores_aula;

create policy professor_aula_escrita on professores_aula
  for all using (
    papel_atual() = 'dono' or (papel_atual() = 'professor' and professor_id = auth.uid())
  ) with check (
    papel_atual() = 'dono' or (papel_atual() = 'professor' and professor_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Aula teste — diferente da particular: acontece dentro de um horário da
-- grade regular (não numa disponibilidade à parte) e pode juntar mais de um
-- aluno na mesma data. Por isso não usa a tabela `aulas` (que trava 1 aluno
-- por particular via unique index) nem o enum tipo_aula — é um agendamento à
-- parte, igual disponibilidade_particular é à parte de aulas_recorrentes.
-- ---------------------------------------------------------------------------

create table aulas_teste (
  id                  uuid primary key default gen_random_uuid(),
  aula_recorrente_id  uuid not null references aulas_recorrentes (id) on delete cascade,
  data                date not null,
  observacoes         text,
  criado_por          uuid references perfis (id) on delete set null,
  criado_em           timestamptz not null default now()
);

create index on aulas_teste (aula_recorrente_id, data);

create table aulas_teste_alunos (
  aula_teste_id uuid not null references aulas_teste (id) on delete cascade,
  aluno_id      uuid not null references alunos (id) on delete cascade,
  primary key (aula_teste_id, aluno_id)
);

-- "Sempre em horário regular": a data escolhida precisa cair no mesmo dia da
-- semana do horário da grade selecionado — mesmo padrão de
-- valida_disponibilidade_particular (0016), só que validando o dia em vez do
-- conflito de hora.
create function valida_aula_teste_dia() returns trigger
language plpgsql as $$
declare
  dia_esperado smallint;
begin
  select dia_semana into dia_esperado from aulas_recorrentes where id = new.aula_recorrente_id;

  if dia_esperado is null then
    raise exception 'Horário da grade não encontrado.';
  end if;

  if extract(dow from new.data)::smallint <> dia_esperado then
    raise exception 'A data escolhida não cai no dia da semana desse horário da grade.';
  end if;

  return new;
end;
$$;

create trigger trg_valida_aula_teste_dia
  before insert or update on aulas_teste
  for each row execute function valida_aula_teste_dia();

-- Só quem responde por algum módulo daquele horário (ou o dono) pode marcar
-- aula teste nele — mesmo espírito de sou_professor_do_pedido (0005).
create function sou_responsavel_pela_aula(p_aula_recorrente_id uuid) returns boolean
language sql stable as $$
  select papel_atual() = 'dono' or exists (
    select 1 from professores_aula pa
     where pa.aula_recorrente_id = p_aula_recorrente_id
       and pa.professor_id = auth.uid()
  );
$$;

alter table aulas_teste        enable row level security;
alter table aulas_teste_alunos enable row level security;

-- Leitura fica restrita à equipe (mesmo padrão de disponibilidade_particular
-- pro lado da escrita) — aula teste é agendamento interno, não um dado que o
-- aluno em teste precisa consultar pelo app.
create policy aula_teste_leitura on aulas_teste
  for select using (eh_equipe());

create policy aula_teste_escrita on aulas_teste
  for all using (sou_responsavel_pela_aula(aula_recorrente_id))
  with check (sou_responsavel_pela_aula(aula_recorrente_id));

create policy aula_teste_alunos_leitura on aulas_teste_alunos
  for select using (eh_equipe());

create policy aula_teste_alunos_escrita on aulas_teste_alunos
  for all using (
    exists (
      select 1 from aulas_teste at_
       where at_.id = aula_teste_id and sou_responsavel_pela_aula(at_.aula_recorrente_id)
    )
  ) with check (
    exists (
      select 1 from aulas_teste at_
       where at_.id = aula_teste_id and sou_responsavel_pela_aula(at_.aula_recorrente_id)
    )
  );
