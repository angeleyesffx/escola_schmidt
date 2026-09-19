-- Escola Schmidt — horários livres do professor para aula particular
-- Rodar em: Supabase > SQL Editor, depois de 0015_perfis_ativo.sql

-- Aula particular só pode ser marcada num horário que o professor abriu de
-- propósito pra isso — não em qualquer hora vaga da agenda dele. É um
-- horário semanal recorrente (dia da semana + hora), igual a grade fixa de
-- aulas_recorrentes, só que por professor em vez de por módulo.
create table disponibilidade_particular (
  id           uuid primary key default gen_random_uuid(),
  professor_id uuid not null references perfis (id) on delete cascade,
  dia_semana   smallint not null check (dia_semana between 0 and 6),
  hora         time not null,
  criado_em    timestamptz not null default now(),
  unique (professor_id, dia_semana, hora)
);

create index on disponibilidade_particular (professor_id);

-- Não deixa o professor abrir um horário livre que já é aula regular dele —
-- a grade sempre vence, disponibilidade pra particular só entra onde não
-- tem conflito.
create function valida_disponibilidade_particular() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1
      from professores_aula pa
      join aulas_recorrentes ar on ar.id = pa.aula_recorrente_id
     where pa.professor_id = new.professor_id
       and ar.dia_semana = new.dia_semana
       and ar.hora = new.hora
       and ar.ativo
  ) then
    raise exception 'Esse horário conflita com uma aula regular desse professor.';
  end if;
  return new;
end;
$$;

create trigger trg_valida_disponibilidade_particular
  before insert or update on disponibilidade_particular
  for each row execute function valida_disponibilidade_particular();

alter table disponibilidade_particular enable row level security;

-- Leitura aberta pra qualquer autenticado — é o que alimenta "quais horas
-- esse professor está livre" na hora de marcar a particular.
create policy disponibilidade_leitura on disponibilidade_particular
  for select using (auth.uid() is not null);

-- Cada professor mexe só na própria agenda livre; dono mexe em qualquer uma.
-- `eh_equipe()` além de professor_id = auth.uid() impede um aluno inserir
-- uma linha "de si mesmo" só porque o id bate.
create policy disponibilidade_escrita on disponibilidade_particular
  for all using (eh_equipe() and (papel_atual() = 'dono' or professor_id = auth.uid()))
  with check (eh_equipe() and (papel_atual() = 'dono' or professor_id = auth.uid()));
